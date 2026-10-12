// Alias operation window: runs one private funding or return operation end to
// end, shows real progress, survives the popup closing, and resumes safely
// after a restart (never auto-resending anything uncertain).

// snarkjs multi-threading builds workers from blob: URLs, which MV3 CSP blocks.
// Its environment sniff falls back to single-threaded proving when it sees Bun.
(globalThis as unknown as { Bun?: object }).Bun = (globalThis as unknown as { Bun?: object }).Bun ?? {
  __aliasSingleThread: true,
};

import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { bgCall, type OperationRecord, type SettingsState } from '../shared/messages';
import { explorerTxUrl } from '../shared/constants';
import { makeConnection } from '../shared/rpc';
import { markSvg } from '../shared/brand';
import { formatWhen, lamportsToSol, shortAddress } from '../shared/format';
import {
  liveConfig,
  onPrivacyLog,
  prepareFirstScan,
  poolFeeLamports,
  runDeposit,
  runWithdraw,
  verifyCircuits,
  verifyExternalSignature,
} from './privacy';

const app = document.getElementById('app')!;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function bg<T>(req: Parameters<typeof bgCall>[0]): Promise<T> {
  const res = await bgCall<T>(req);
  if (!res.ok) throw new Error(res.error?.message ?? 'Something went wrong');
  return res.result as T;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ---------- UI model ----------
type StepState = 'todo' | 'active' | 'done' | 'failed';
interface StepView {
  id: string;
  label: string;
  state: StepState;
  note?: string; // may contain trusted HTML built here
}

let steps: StepView[] = [];
let title = 'Private operation';
let subtitle = '';
let logline = '';
let footerHtml = '';
let errorText = '';

function setStep(id: string, state: StepState, note?: string): void {
  const step = steps.find((s) => s.id === id);
  if (!step) return;
  step.state = state;
  if (note !== undefined) step.note = note;
  render();
  mirrorToCompanion(step);
}

// Mirror the active step to the funding page (fund operations only), so it
// shows real progress or the real error instead of an endless spinner.
function mirrorToCompanion(step: StepView): void {
  if (!record || record.kind !== 'fund') return;
  const plain = `${step.label}${step.note ? `: ${step.note.replace(/<[^>]+>/g, '')}` : ''}`;
  // A scheduled payout ('todo' with a note) means this page has nothing left to do.
  const state =
    step.state === 'failed' ? 'failed' : (step.id === 'done' && step.state === 'done') || step.state === 'todo' ? 'done' : 'working';
  if (step.state === 'todo' && step.id !== 'withdraw') return;
  void bgCall({ type: 'ops.companionStatus', opId: record.id, text: plain, state }).catch(() => undefined);
}

let lastLogMirror = 0;
function setLog(line: string): void {
  logline = line;
  const el = app.querySelector('.logline');
  if (el) el.textContent = line;
  // Also show SDK progress (pool scan, proving) on the funding page, throttled.
  const active = steps.find((st) => st.state === 'active');
  if (record?.kind === 'fund' && active && Date.now() - lastLogMirror > 1500) {
    lastLogMirror = Date.now();
    void bgCall({ type: 'ops.companionStatus', opId: record.id, text: `${active.label}: ${line}`, state: 'working' }).catch(
      () => undefined,
    );
  }
}

function render(): void {
  app.innerHTML = `
    <div class="ops-head">
      ${markSvg(40)}
      <div><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)}</div></div>
    </div>
    <div class="steps">
      ${steps
        .map(
          (s, i) => `<div class="card step ${s.state === 'active' ? 'active' : s.state === 'done' ? 'done' : s.state === 'failed' ? 'failed' : ''}">
            <div class="dot">${s.state === 'done' ? '✓' : s.state === 'failed' ? '!' : i + 1}</div>
            <div class="body">
              <div class="label">${esc(s.label)}</div>
              ${s.note ? `<div class="note">${s.note}</div>` : ''}
            </div>
            ${s.state === 'active' ? '<div class="spin"></div>' : ''}
          </div>`,
        )
        .join('')}
    </div>
    <div class="footer">
      <div class="error-text">${esc(errorText)}</div>
      <div class="logline">${esc(logline)}</div>
      ${footerHtml}
    </div>`;
}

function explorerLink(sig: string, network: OperationRecord['network'], label: string): string {
  return `<a href="${explorerTxUrl(sig, network)}" target="_blank" rel="noreferrer">${esc(label)}</a>`;
}

// ---------- journal helpers ----------
let record: OperationRecord;

async function save(patch: Partial<OperationRecord>): Promise<void> {
  record = { ...record, ...patch, updatedAt: Date.now() };
  await bg({ type: 'ops.update', record });
}

async function confirmSignature(connection: Connection, signature: string, timeoutMs = 90_000): Promise<'confirmed' | 'failed' | 'unknown'> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const s = st.value[0];
    if (s?.err) return 'failed';
    if (s?.confirmationStatus === 'confirmed' || s?.confirmationStatus === 'finalized') return 'confirmed';
    await new Promise((r) => setTimeout(r, 2500));
  }
  return 'unknown';
}

// ---------- flows ----------
// `#<id>&now=1` means the user explicitly asked to pay out now.
const [opIdFromHash, ...hashFlags] = location.hash.replace(/^#/, '').split('&');
let payNow = hashFlags.includes('now=1');
let keepAlive: ReturnType<typeof setInterval> | null = null;

async function main(): Promise<void> {
  const opId = opIdFromHash;
  onPrivacyLog(({ message }) => setLog(message.slice(0, 160)));

  // Keep the service worker alive while this window works.
  if (!keepAlive) keepAlive = setInterval(() => void bgCall({ type: 'ping' }), 20_000);

  try {
    record = await bg<OperationRecord>({ type: 'ops.get', id: opId });
  } catch {
    title = 'Operation not found';
    subtitle = 'Unlock Alias from the toolbar and open this operation again from History.';
    render();
    return;
  }

  const settings = await bg<SettingsState>({ type: 'settings.get' });
  const aliases = await bg<{ id: string; name: string; address: string; index: number }[]>({ type: 'alias.list' });
  const alias = aliases.find((a) => a.id === record.aliasId);
  if (!alias) {
    title = 'Alias not found';
    render();
    return;
  }

  title = record.kind === 'fund' ? 'Fund privately' : 'Return privately';
  subtitle = `${lamportsToSol(record.amountLamports)} SOL · ${alias.name}`;

  // Finished operations just show their summary.
  if (record.step === 'done' || record.step === 'failed') {
    renderSummary(alias.name);
    return;
  }

  // Resume safety: anything already submitted is only rechecked, never resent.
  if (record.withdrawTx) {
    steps = [{ id: 'recheck', label: 'Checking the submitted withdrawal', state: 'active' }];
    render();
    const next = await bg<OperationRecord>({ type: 'ops.recheck', id: record.id });
    record = next;
    renderSummary(alias.name);
    return;
  }

  const secret = await bg<{ secretKeyB64: string }>({ type: 'ops.aliasSecret', aliasId: alias.id });
  const aliasKeypair = Keypair.fromSecretKey(b64ToBytes(secret.secretKeyB64));
  // A brand-new alias owns nothing in the pool: skip the history download.
  const scan = await prepareFirstScan(aliasKeypair.publicKey, async () =>
    (await bg<{ skipHistory: boolean }>({ type: 'ops.scanHint', aliasId: alias.id })).skipHistory,
  );
  if (scan === 'full') {
    setLog('First use of this alias with Privacy Cash: checking the pool history for its funds. This can take several minutes once.');
  }
  // Privacy Cash is mainnet only; your own RPC (Settings) first, then public fallbacks.
  const connection = makeConnection('mainnet-beta', settings.customRpc);

  if (record.kind === 'fund') await runFund(connection, aliasKeypair, alias, settings);
  else await runReturn(connection, aliasKeypair, alias);
}

function fail(stepId: string, message: string): void {
  errorText = message;
  setStep(stepId, 'failed', message);
  footerHtml = `<button class="btn btn-soft" id="close">Close</button>`;
  render();
  app.querySelector('#close')?.addEventListener('click', () => window.close());
  void save({ step: 'failed', error: message });
}

async function runFund(
  connection: Connection,
  aliasKeypair: Keypair,
  alias: { name: string; address: string },
  settings: SettingsState,
): Promise<void> {
  const resumingAfterDeposit = Boolean(record.depositTx);
  steps = [
    { id: 'circuits', label: 'Check proof files', state: 'todo' },
    { id: 'wallet', label: 'Choose your main wallet', state: 'todo' },
    { id: 'deposit', label: 'Main wallet deposits into Privacy Cash', state: 'todo' },
    { id: 'withdraw', label: `Pool pays ${alias.name}`, state: 'todo' },
    { id: 'done', label: 'Done', state: 'todo' },
  ];
  render();

  // 1. Circuit integrity.
  setStep('circuits', 'active');
  let keyBasePath: string;
  try {
    const check = await verifyCircuits();
    keyBasePath = check.keyBasePath;
    setStep('circuits', 'done', 'SHA-256 verified against the build manifest');
  } catch (e) {
    return fail('circuits', (e as Error).message);
  }

  // Live fees and minimums before accepting the amount.
  let cfg: Awaited<ReturnType<typeof liveConfig>>;
  try {
    cfg = await liveConfig();
  } catch {
    return fail('deposit', 'Could not load live Privacy Cash fees. Check your connection and try again.');
  }
  if (cfg.minimumSol > 0 && record.amountLamports < cfg.minimumSol * 1e9) {
    return fail('deposit', `Privacy Cash currently needs at least ${cfg.minimumSol} SOL. Start again with a larger amount.`);
  }
  const fee = poolFeeLamports(record.amountLamports, {
    withdrawFeeRate: cfg.withdrawFeeRate,
    withdrawRentFeeSol: cfg.withdrawRentFeeSol,
  });
  subtitle = `${lamportsToSol(record.amountLamports)} SOL · pool fee ≈ ${lamportsToSol(fee)} SOL · ${alias.name}`;
  await save({ feeLamports: fee, netLamports: record.amountLamports - fee });

  if (!resumingAfterDeposit) {
    // 2. Companion tab: wallet selection, then signature.
    setStep('wallet', 'active', 'A funding page just opened. Pick your main wallet there.');
    const companionUrl = `${settings.companionUrl.replace(/\/$/, '')}/#op=${record.id}`;
    await chrome.tabs.create({ url: companionUrl, active: true });
    await save({ step: 'awaiting-wallet' });
    let mainWallet: PublicKey;
    try {
      const picked = await bg<{ address: string; walletName: string }>({ type: 'ops.companionConnect', opId: record.id });
      mainWallet = new PublicKey(picked.address);
      await save({ mainWallet: picked.address, mainWalletName: picked.walletName });
      setStep('wallet', 'done', `${esc(picked.walletName)} · ${esc(shortAddress(picked.address, 5, 5))}`);
    } catch (e) {
      return fail('wallet', (e as Error).message);
    }

    // 3. Build the proof, send the unsigned transaction to the main wallet, verify, relay.
    setStep('deposit', 'active', 'Checking your balance and the pool, then building the zero-knowledge proof on this computer.');
    await save({ step: 'proving-deposit' });
    try {
      const result = await runDeposit({
        connection,
        amountLamports: record.amountLamports,
        aliasKeypair,
        signerPubkey: mainWallet,
        keyBasePath,
        signTransaction: async (tx: VersionedTransaction) => {
          setStep('deposit', 'active', 'Waiting for your main wallet to approve the deposit…');
          await save({ step: 'awaiting-signature' });
          const { signedTxB64 } = await bg<{ signedTxB64: string }>({
            type: 'ops.companionSign',
            opId: record.id,
            txBase64: bytesToB64(tx.serialize()),
          });
          const signed = verifyExternalSignature(tx, b64ToBytes(signedTxB64), mainWallet, (m, s, p) =>
            nacl.sign.detached.verify(m, s, p),
          );
          // Journal the signature BEFORE the SDK relays it.
          const signature = bs58.encode(signed.signatures[0]);
          await save({ depositTx: signature, step: 'deposit-submitted' });
          setStep('deposit', 'active', `Submitted. ${explorerLink(signature, record.network, 'View deposit on Solscan')}`);
          return signed;
        },
      });
      const confirm = await confirmSignature(connection, result.tx);
      if (confirm === 'failed') return fail('deposit', 'The deposit transaction failed on chain. Nothing left the pool; you can start again.');
      if (confirm === 'unknown') {
        await save({ step: 'unknown' });
        return fail('deposit', 'The deposit status is still unknown. Reopen this operation from History and recheck; it was not resent.');
      }
      await save({ step: 'deposit-confirmed' });
      setStep('deposit', 'done', `Confirmed · ${explorerLink(record.depositTx!, record.network, 'View on Solscan')}`);
    } catch (e) {
      return fail('deposit', (e as Error).message);
    }
  } else {
    setStep(
      'wallet',
      'done',
      record.mainWallet
        ? `${record.mainWalletName ? `${esc(record.mainWalletName)} · ` : ''}${esc(shortAddress(record.mainWallet, 5, 5))}`
        : 'Chosen earlier',
    );
    const confirm = await confirmSignature(connection, record.depositTx!, 30_000);
    if (confirm === 'failed') return fail('deposit', 'The earlier deposit failed on chain. Start a new funding operation.');
    if (confirm === 'unknown') return fail('deposit', 'The earlier deposit is still unconfirmed. Recheck later from History; it was not resent.');
    setStep('deposit', 'done', `Confirmed · ${explorerLink(record.depositTx!, record.network, 'View on Solscan')}`);
  }

  // 4. Withdraw from the pool to the alias, now or at the chosen later time.
  //    Retries only re-scan; a submitted withdrawal is never sent twice
  //    because it is journaled first.
  if (await waitForPayout(alias.name)) return;
  await withdrawLeg(connection, aliasKeypair, new PublicKey(alias.address), `Pool pays ${alias.name}`);
}

async function runReturn(connection: Connection, aliasKeypair: Keypair, alias: { name: string; address: string }): Promise<void> {
  const destination = new PublicKey(record.mainWallet!);
  const resumingAfterDeposit = Boolean(record.depositTx);
  steps = [
    { id: 'circuits', label: 'Check proof files', state: 'todo' },
    { id: 'approve', label: `Approve the deposit from ${alias.name}`, state: 'todo' },
    { id: 'deposit', label: 'Alias deposits into Privacy Cash', state: 'todo' },
    { id: 'withdraw', label: `Pool pays ${shortAddress(destination.toBase58(), 5, 5)}`, state: 'todo' },
    { id: 'done', label: 'Done', state: 'todo' },
  ];
  render();

  setStep('circuits', 'active');
  let keyBasePath: string;
  try {
    const check = await verifyCircuits();
    keyBasePath = check.keyBasePath;
    setStep('circuits', 'done', 'SHA-256 verified against the build manifest');
  } catch (e) {
    return fail('circuits', (e as Error).message);
  }

  let cfg: Awaited<ReturnType<typeof liveConfig>>;
  try {
    cfg = await liveConfig();
  } catch {
    return fail('deposit', 'Could not load live Privacy Cash fees. Check your connection and try again.');
  }
  if (cfg.minimumSol > 0 && record.amountLamports < cfg.minimumSol * 1e9) {
    return fail('deposit', `Privacy Cash currently needs at least ${cfg.minimumSol} SOL. Start again with a larger amount.`);
  }
  const fee = poolFeeLamports(record.amountLamports, {
    withdrawFeeRate: cfg.withdrawFeeRate,
    withdrawRentFeeSol: cfg.withdrawRentFeeSol,
  });
  await save({ feeLamports: fee, netLamports: record.amountLamports - fee });

  if (!resumingAfterDeposit) {
    // Explicit consent for the alias-signed deposit: its own approval, not
    // bundled into anything else.
    setStep('approve', 'active');
    footerHtml = `
      <div class="card" style="padding:11px 13px">
        <div style="display:flex;justify-content:space-between;font-size:13.5px"><span class="muted">Deposit from ${esc(alias.name)}</span><strong>${lamportsToSol(record.amountLamports)} SOL</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px"><span class="muted">Destination gets (estimate)</span><strong>≈ ${lamportsToSol(record.amountLamports - fee)} SOL</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:13.5px"><span class="muted">To</span><strong>${esc(shortAddress(destination.toBase58(), 6, 6))}</strong></div>
      </div>
      <button class="btn btn-primary" id="approve-return">Approve deposit</button>
      <button class="btn btn-ghost" id="cancel-return">Cancel</button>`;
    render();
    const approved = await new Promise<boolean>((resolve) => {
      app.querySelector('#approve-return')?.addEventListener('click', () => resolve(true));
      app.querySelector('#cancel-return')?.addEventListener('click', () => resolve(false));
    });
    footerHtml = '';
    if (!approved) return fail('approve', 'You cancelled. Nothing was sent.');
    setStep('approve', 'done');

    setStep('deposit', 'active', 'Generating the zero-knowledge proof. This runs locally and can take a minute.');
    await save({ step: 'proving-deposit' });
    try {
      const result = await runDeposit({
        connection,
        amountLamports: record.amountLamports,
        aliasKeypair,
        signerPubkey: aliasKeypair.publicKey,
        keyBasePath,
        signTransaction: async (tx: VersionedTransaction) => {
          tx.sign([aliasKeypair]);
          const signature = bs58.encode(tx.signatures[0]);
          await save({ depositTx: signature, step: 'deposit-submitted' });
          setStep('deposit', 'active', `Submitted. ${explorerLink(signature, record.network, 'View deposit on Solscan')}`);
          return tx;
        },
      });
      const confirm = await confirmSignature(connection, result.tx);
      if (confirm === 'failed') return fail('deposit', 'The deposit transaction failed on chain. The alias balance is unchanged; you can start again.');
      if (confirm === 'unknown') {
        await save({ step: 'unknown' });
        return fail('deposit', 'The deposit status is still unknown. Reopen this operation from History and recheck; it was not resent.');
      }
      await save({ step: 'deposit-confirmed' });
      setStep('deposit', 'done', `Confirmed · ${explorerLink(record.depositTx!, record.network, 'View on Solscan')}`);
    } catch (e) {
      return fail('deposit', (e as Error).message);
    }
  } else {
    setStep('approve', 'done');
    const confirm = await confirmSignature(connection, record.depositTx!, 30_000);
    if (confirm === 'failed') return fail('deposit', 'The earlier deposit failed on chain. Start a new return operation.');
    if (confirm === 'unknown') return fail('deposit', 'The earlier deposit is still unconfirmed. Recheck later from History; it was not resent.');
    setStep('deposit', 'done', `Confirmed · ${explorerLink(record.depositTx!, record.network, 'View on Solscan')}`);
  }

  if (await waitForPayout('your main wallet')) return;
  await withdrawLeg(connection, aliasKeypair, destination, 'Pool pays the destination');
}

// Timing split. Returns true when the payout is scheduled for later (this
// window then just shows the wait), false when it should run now. While
// waiting, the SOL sits in the pool, owned by the alias's shielded key.
async function waitForPayout(payee: string): Promise<boolean> {
  let payAfter = record.payAfter;
  if (payAfter === undefined && (record.delayMinutes ?? 0) > 0) {
    payAfter = Date.now() + record.delayMinutes! * 60_000;
    await save({ payAfter, step: 'deposit-confirmed' });
    await bg({ type: 'ops.schedulePay', id: record.id, when: payAfter }).catch(() => undefined);
  }
  if (payNow || payAfter === undefined || payAfter <= Date.now()) return false;

  // Let the vault auto-lock normally during a long wait.
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
  setStep(
    'withdraw',
    'todo',
    `Scheduled for ${esc(formatWhen(payAfter))}. Until then your SOL waits in the pool. Waiting makes the deposit and the payout harder to match by time.`,
  );
  setStep('done', 'todo', `Alias puts a badge on its toolbar icon when it is time. Open Alias and tap Pay.`);
  footerHtml = `<button class="btn btn-soft" id="paynow">Pay ${esc(payee)} now instead</button>
    <button class="btn btn-ghost" id="close">Close this window</button>`;
  render();
  app.querySelector('#close')?.addEventListener('click', () => window.close());
  app.querySelector('#paynow')?.addEventListener('click', () => {
    payNow = true;
    footerHtml = '';
    render();
    void main();
  });
  return true;
}

async function withdrawLeg(
  connection: Connection,
  aliasKeypair: Keypair,
  recipient: PublicKey,
  label: string,
): Promise<void> {
  setStep('withdraw', 'active', 'Waiting for the pool to index the deposit, then proving the withdrawal…');
  await save({ step: 'proving-withdraw' });
  const keyBasePath = chrome.runtime.getURL('circuits/transaction2');
  let lastError = '';
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const result = await runWithdraw({
        connection,
        amountLamports: record.amountLamports,
        aliasKeypair,
        recipient,
        keyBasePath,
      });
      await save({ withdrawTx: result.tx, step: 'withdraw-submitted' });
      setStep('withdraw', 'active', `Submitted. ${explorerLink(result.tx, record.network, 'View withdrawal on Solscan')}`);
      const confirm = await confirmSignature(connection, result.tx);
      if (confirm === 'failed') return fail('withdraw', 'The withdrawal failed on chain. Your shielded balance is still yours; recheck from History before retrying.');
      if (confirm === 'unknown') {
        await save({ step: 'unknown' });
        return fail('withdraw', 'The withdrawal status is still unknown. Recheck from History; it was not resent.');
      }
      // Independent verification: the recipient actually received funds.
      const received = result.amount_in_lamports;
      await save({
        step: 'done',
        netLamports: received,
        stepNote: result.isPartial ? 'Partial: the shielded balance covered less than requested.' : undefined,
      });
      setStep(
        'withdraw',
        'done',
        `${result.isPartial ? 'Partial withdrawal' : 'Confirmed'} · ${lamportsToSol(received)} SOL to ${esc(shortAddress(recipient.toBase58(), 5, 5))} · ${explorerLink(result.tx, record.network, 'View on Solscan')}`,
      );
      setStep('done', 'done', buildDoneNote(label, received));
      footerHtml = `<button class="btn btn-mint" id="close">All set</button>`;
      render();
      app.querySelector('#close')?.addEventListener('click', () => window.close());
      return;
    } catch (e) {
      lastError = (e as Error).message;
      // Nothing was submitted in a failed attempt (submission is journaled
      // first), so waiting and rescanning is safe.
      if (attempt < 10) {
        setStep('withdraw', 'active', `Pool not ready yet (attempt ${attempt}/10). Rescanning in 10 s… `);
        await new Promise((r) => setTimeout(r, 10_000));
      }
    }
  }
  return fail('withdraw', `The pool withdrawal did not go through: ${lastError}. Your deposit is safe in your shielded balance; reopen this operation from History to try the withdrawal again.`);
}

function buildDoneNote(label: string, received: number): string {
  if (record.kind === 'fund') {
    return `Your alias received ${lamportsToSol(received)} SOL through Privacy Cash. Two separate pool transactions; no direct public link to your main wallet.`;
  }
  return `The destination received ${lamportsToSol(received)} SOL through Privacy Cash. Two separate pool transactions; no direct public link to the alias.`;
}

function renderSummary(aliasName: string): void {
  const stepText: Record<string, string> = {
    done: 'Completed',
    failed: 'Failed',
    unknown: 'Status unknown',
    'deposit-confirmed': 'Deposit confirmed. Withdrawal not finished yet',
  };
  steps = [
    {
      id: 'summary',
      label: `${record.kind === 'fund' ? 'Fund' : 'Return'} · ${lamportsToSol(record.amountLamports)} SOL · ${aliasName}`,
      state: record.step === 'done' ? 'done' : record.step === 'failed' ? 'failed' : 'active',
      note: [
        stepText[record.step] ?? record.step,
        record.error ? esc(record.error) : '',
        record.depositTx ? explorerLink(record.depositTx, record.network, 'Deposit on Solscan') : '',
        record.withdrawTx ? explorerLink(record.withdrawTx, record.network, 'Withdrawal on Solscan') : '',
        record.stepNote ? esc(record.stepNote) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ];
  footerHtml = '';
  if (record.step === 'deposit-confirmed' && !record.withdrawTx) {
    footerHtml = `<button class="btn btn-primary" id="resume">Continue the withdrawal</button>`;
  } else if (record.step === 'unknown') {
    footerHtml = `<button class="btn btn-soft" id="recheck">Recheck status</button>`;
  }
  footerHtml += `<button class="btn btn-ghost" id="close">Close</button>`;
  render();
  app.querySelector('#close')?.addEventListener('click', () => window.close());
  app.querySelector('#recheck')?.addEventListener('click', async () => {
    record = await bg<OperationRecord>({ type: 'ops.recheck', id: record.id });
    renderSummary(aliasName);
  });
  app.querySelector('#resume')?.addEventListener('click', () => {
    // Re-run the flow; the deposit leg is skipped because depositTx exists.
    payNow = true;
    void main();
  });
}

void main().catch((e: unknown) => {
  errorText = e instanceof Error ? e.message : 'Something went wrong';
  render();
});
