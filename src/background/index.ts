// Alias background service worker: request router, signing policy, approvals.
import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import {
  ERR,
  type BgRequest,
  type BgResponse,
  type ConnectApprovalRequest,
  type MsgApprovalRequest,
  type OperationRecord,
  type TxApprovalRequest,
} from '../shared/messages';
import { PRIVACY_CASH_NETWORK } from '../shared/constants';
import { uid } from '../shared/format';
import * as vault from './vault';
import * as aliases from './aliases';
import * as settingsStore from './settings';
import * as origins from './origins';
import * as journal from './journal';
import { simulateForAlias } from './simulate';
import {
  askCompanion,
  askUser,
  companionTabFor,
  getApproval,
  notifyCompanion,
  registerCompanionTab,
  resolveApproval,
  resolveCompanion,
  setCompanionDeliverer,
  type ConnectOutcome,
} from './approvals';

function ok<T>(result: T): BgResponse<T> {
  return { ok: true, result };
}
function fail(code: number, message: string): BgResponse<never> {
  return { ok: false, error: { code, message } };
}

function b64ToBytes(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// ---------- extension pages (popup / ops / manager) ----------
chrome.runtime.onMessage.addListener((raw: BgRequest, sender, sendResponse) => {
  // Only our own extension pages may use this channel.
  if (sender.id !== chrome.runtime.id || sender.tab?.url?.startsWith('http')) {
    // Messages from content scripts arrive with sender.tab set to an http(s) page.
    // Those must use the port protocol below, never the privileged channel.
    sendResponse(fail(ERR.UNAUTHORIZED, 'Not allowed'));
    return false;
  }
  handlePrivileged(raw)
    .then(sendResponse)
    .catch((e: unknown) => sendResponse(fail(ERR.INTERNAL, e instanceof Error ? e.message : 'Internal error')));
  return true; // async
});

async function handlePrivileged(req: BgRequest): Promise<BgResponse> {
  await vault.touchActivity();
  switch (req.type) {
    case 'ping':
      return ok(true);
    case 'vault.status':
      return ok({ exists: await vault.vaultExists(), unlocked: await vault.isUnlocked() });
    case 'vault.create': {
      const { mnemonic } = await vault.createVault(req.password);
      return ok({ mnemonic });
    }
    case 'vault.unlock':
      await vault.unlock(req.password);
      return ok(true);
    case 'vault.lock':
      await vault.lock();
      return ok(true);
    case 'vault.revealMnemonic':
      return ok({ mnemonic: await vault.revealMnemonic(req.password) });
    case 'vault.importMnemonic':
      await vault.importVault(req.password, req.mnemonic);
      return ok(true);
    case 'alias.list':
      return ok(await aliases.listAliases());
    case 'alias.create':
      return ok(await aliases.createAlias(req.name, req.kind, req.emoji));
    case 'alias.update':
      return ok(await aliases.updateAlias(req.id, { name: req.name, emoji: req.emoji }));
    case 'alias.rename':
      await aliases.renameAlias(req.id, req.name);
      return ok(true);
    case 'alias.balance':
      return ok({ lamports: await aliases.aliasBalanceLamports(req.id) });
    case 'settings.get':
      return ok(await settingsStore.getSettings());
    case 'settings.update':
      return ok(await settingsStore.updateSettings(req.patch));
    case 'origins.list':
      return ok(await origins.listGrants());
    case 'origins.revoke':
      await origins.revokeGrant(req.origin);
      return ok(true);
    case 'approval.get': {
      const payload = getApproval(req.requestId);
      if (!payload) return fail(ERR.INTERNAL, 'This request is no longer pending');
      return ok(payload);
    }
    case 'approval.resolveConnect':
      resolveApproval(req.requestId, { approved: req.approved, aliasId: req.aliasId } satisfies ConnectOutcome);
      return ok(true);
    case 'approval.resolveTx':
    case 'approval.resolveMsg':
      resolveApproval(req.requestId, { approved: req.approved });
      return ok(true);
    case 'tx.simulate':
      return ok(await simulateForAlias(req.txBase64, req.aliasAddress));
    case 'ops.start':
      return ok(await startOperation(req.kind, req.aliasId, req.amountLamports, req.destination, req.delayMinutes));
    case 'ops.open': {
      const record = await journal.getOperation(req.id);
      if (!record) return fail(ERR.INTERNAL, 'Operation not found');
      await openOperationWindow(record.id, req.payNow === true);
      return ok(true);
    }
    case 'ops.schedulePay': {
      const record = await journal.getOperation(req.id);
      if (!record) return fail(ERR.INTERNAL, 'Operation not found');
      if (!(req.when > Date.now())) return ok(true);
      await chrome.alarms.create(`pay:${record.id}`, { when: req.when });
      return ok(true);
    }
    case 'ops.get': {
      const record = await journal.getOperation(req.id);
      if (!record) return fail(ERR.INTERNAL, 'Operation not found');
      return ok(record);
    }
    case 'ops.list':
      return ok(await journal.listOperations());
    case 'ops.update':
      await journal.putOperation(req.record);
      return ok(true);
    case 'ops.aliasSecret': {
      // Only extension pages reach this handler; the secret is used by the
      // ops page to run the Privacy Cash SDK and never leaves the extension.
      const kp = await aliases.aliasKeypairById(req.aliasId);
      return ok({ secretKeyB64: bytesToB64(kp.secretKey) });
    }
    case 'ops.companionConnect': {
      const wallet = await askCompanion<{ address: string; walletName: string }>(req.opId, 'pick-wallet');
      return ok(wallet);
    }
    case 'ops.companionSign': {
      const signed = await askCompanion<{ signedTxB64: string }>(req.opId, 'sign', req.txBase64);
      return ok(signed);
    }
    case 'ops.scanHint':
      return ok({ skipHistory: await canSkipPoolHistory(req.aliasId) });
    case 'ops.companionStatus':
      notifyCompanion(req.opId, req.text.slice(0, 400), req.state);
      return ok(true);
    case 'ops.recheck': {
      const record = await journal.getOperation(req.id);
      if (!record) return fail(ERR.INTERNAL, 'Operation not found');
      return ok(await recheckOperation(record));
    }
    default:
      return fail(ERR.UNSUPPORTED, 'Unknown request');
  }
}

// An alias provably owns nothing in the Privacy Cash pool when its 12 words
// were generated by this install and no earlier operation of it ever reached
// the pool. Only then may the first scan start at the pool's current end.
export async function canSkipPoolHistory(aliasId: string): Promise<boolean> {
  if ((await vault.vaultOrigin()) !== 'created') return false;
  const ops = await journal.listOperations();
  return !ops.some((o) => o.aliasId === aliasId && (o.depositTx || o.withdrawTx));
}

// Allowed payout delays (minutes). Anything else is refused rather than guessed.
export const PAYOUT_DELAYS = [0, 60, 1440] as const;

export async function openOperationWindow(id: string, payNow = false): Promise<void> {
  await chrome.windows.create({
    url: chrome.runtime.getURL(`ops/ops.html#${id}${payNow ? '&now=1' : ''}`),
    type: 'popup',
    width: 420,
    height: 680,
    focused: true,
  });
}

export async function startOperation(
  kind: 'fund' | 'return',
  aliasId: string,
  amountLamports: number,
  destination?: string,
  delayMinutes = 0,
): Promise<OperationRecord> {
  if (!(PAYOUT_DELAYS as readonly number[]).includes(delayMinutes)) {
    throw new Error('Choose when the pool should pay out');
  }
  const settings = await settingsStore.getSettings();
  if (settings.network !== PRIVACY_CASH_NETWORK) {
    throw new Error('Privacy Cash runs on Solana mainnet only. Enable mainnet in Settings first.');
  }
  if (!settings.mainnetEnabled) throw new Error('Enable mainnet in Settings first.');
  if (!(amountLamports > 0)) throw new Error('Choose an amount first');
  if (amountLamports > settings.perOperationSol * 1e9) {
    throw new Error(`That is above your per-operation limit of ${settings.perOperationSol} SOL (Settings)`);
  }
  const alias = await aliases.getAlias(aliasId);
  if (!alias) throw new Error('Alias not found');
  if (kind === 'return') {
    if (!destination) throw new Error('Choose a destination first');
    new PublicKey(destination); // throws on invalid address
  }
  const record: OperationRecord = {
    id: uid(),
    kind,
    aliasId,
    amountLamports,
    mainWallet: destination,
    delayMinutes,
    step: 'created',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    network: settings.network,
  };
  await journal.putOperation(record);
  // The operation runs in its own window so it survives the popup closing.
  await openOperationWindow(record.id);
  return record;
}

async function recheckOperation(record: OperationRecord): Promise<OperationRecord> {
  // Independently verify any submitted legs on chain. Unknown stays unknown.
  const connection = await settingsStore.getConnection();
  const check = async (sig: string | undefined) => {
    if (!sig) return 'missing';
    const st = await connection.getSignatureStatuses([sig], { searchTransactionHistory: true });
    const s = st.value[0];
    if (!s) return 'unknown';
    if (s.err) return 'failed';
    if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') return 'confirmed';
    return 'pending';
  };
  const dep = await check(record.depositTx);
  const wit = await check(record.withdrawTx);
  let step = record.step;
  if (record.withdrawTx) {
    if (wit === 'confirmed') step = 'done';
    else if (wit === 'failed') step = 'failed';
    else step = 'unknown';
  } else if (record.depositTx) {
    if (dep === 'confirmed') step = 'deposit-confirmed';
    else if (dep === 'failed') step = 'failed';
    else step = 'unknown';
  }
  const next = { ...record, step, updatedAt: Date.now() };
  await journal.putOperation(next);
  return next;
}

// ---------- dapp ports (content relay) ----------
interface PortRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'alias-relay') return;
  const sender = port.sender;
  const origin = sender?.origin ?? (sender?.url ? new URL(sender.url).origin : undefined);
  const tabId = sender?.tab?.id;
  if (!origin || tabId === undefined) {
    port.disconnect();
    return;
  }

  port.onMessage.addListener((msg: PortRequest) => {
    handleDapp(origin, tabId, msg)
      .then((result) => port.postMessage({ id: msg.id, ok: true, result }))
      .catch((e: unknown) => {
        const err =
          e instanceof DappError
            ? { code: e.code, message: e.message }
            : { code: ERR.INTERNAL, message: e instanceof Error ? e.message : 'Internal error' };
        try {
          port.postMessage({ id: msg.id, ok: false, error: err });
        } catch {
          // Port already gone; nothing to do.
        }
      });
  });
});

class DappError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

async function requireGrantedAlias(origin: string) {
  const settings = await settingsStore.getSettings();
  const grant = await origins.getGrant(origin, settings.network);
  if (!grant) throw new DappError(ERR.UNAUTHORIZED, 'This site is not connected to Alias');
  const alias = await aliases.getAlias(grant.aliasId);
  if (!alias) throw new DappError(ERR.UNAUTHORIZED, 'The approved alias no longer exists');
  return { alias, settings };
}

export async function handleDapp(origin: string, tabId: number, msg: PortRequest): Promise<unknown> {
  await vault.touchActivity();
  const params = msg.params ?? {};
  switch (msg.method) {
    case 'connect': {
      const settings = await settingsStore.getSettings();
      const existing = await origins.getGrant(origin, settings.network);
      if (existing) {
        const alias = await aliases.getAlias(existing.aliasId);
        if (alias) return { address: alias.address, network: settings.network };
      }
      if ((params as { silent?: boolean }).silent) {
        throw new DappError(ERR.UNAUTHORIZED, 'Not connected');
      }
      const list = await aliases.listAliases();
      const rec = origins.recommendForOrigin(origin, list);
      const request: ConnectApprovalRequest = {
        requestId: uid(),
        origin,
        siteLabel: rec.siteLabel,
        recommendedAliasId: rec.aliasId,
        recommendedReason: rec.reason,
        recommendedKind: rec.kind,
        tabId,
      };
      const outcome = await askUser<ConnectOutcome>({ kind: 'connect', request });
      if (!outcome.approved || !outcome.aliasId) {
        throw new DappError(ERR.USER_REJECTED, 'Connection request was declined');
      }
      const alias = await aliases.getAlias(outcome.aliasId);
      if (!alias) throw new DappError(ERR.INTERNAL, 'Alias not found');
      await origins.saveGrant({
        origin,
        aliasId: alias.id,
        network: settings.network,
        grantedAt: Date.now(),
      });
      return { address: alias.address, network: settings.network };
    }

    case 'disconnect':
      return true;

    case 'signTransaction':
    case 'signAndSendTransaction': {
      const { alias, settings } = await requireGrantedAlias(origin);
      const txB64 = (params as { transaction?: string }).transaction;
      if (typeof txB64 !== 'string') throw new DappError(ERR.UNSUPPORTED, 'Missing transaction');
      const requested = (params as { address?: string }).address;
      if (requested && requested !== alias.address) {
        throw new DappError(ERR.UNAUTHORIZED, 'That account is not approved for this site');
      }
      const tx = VersionedTransaction.deserialize(b64ToBytes(txB64));
      const keys = tx.message.staticAccountKeys;
      const signerCount = tx.message.header.numRequiredSignatures;
      const aliasPk = new PublicKey(alias.address);
      const signerIndex = keys.slice(0, signerCount).findIndex((k) => k.equals(aliasPk));
      if (signerIndex === -1) {
        throw new DappError(ERR.UNAUTHORIZED, 'This transaction is not for the connected alias');
      }

      const request: TxApprovalRequest = {
        requestId: uid(),
        origin,
        aliasId: alias.id,
        mode: msg.method === 'signTransaction' ? 'sign' : 'signAndSend',
        txBase64: txB64,
        tabId,
      };
      const outcome = await askUser<{ approved: boolean }>({ kind: 'tx', request });
      if (!outcome.approved) throw new DappError(ERR.USER_REJECTED, 'Transaction was declined');

      // Per-transaction mainnet limit, checked against the simulated SOL spend.
      if (settings.network === 'mainnet-beta') {
        const sim = await simulateForAlias(txB64, alias.address);
        const solEffect = sim.effects.find((e) => e.kind === 'sol');
        const spend = solEffect ? -Number(solEffect.delta) : 0;
        if (!sim.ok) {
          throw new DappError(ERR.LIMIT, 'Could not establish what this transaction does, so it was not signed');
        }
        if (spend > settings.perTransactionSol * 1e9) {
          throw new DappError(
            ERR.LIMIT,
            `This would spend more than your ${settings.perTransactionSol} SOL per-transaction limit`,
          );
        }
      }

      const keypair = await aliases.aliasKeypairById(alias.id);
      tx.sign([keypair]);
      const signedB64 = bytesToB64(tx.serialize());

      if (msg.method === 'signTransaction') {
        return { signedTransaction: signedB64 };
      }
      // Submit exactly once; never auto-resend.
      const connection = await settingsStore.getConnection();
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 0,
      });
      return { signature: bs58.encode(bs58.decode(signature)) };
    }

    case 'signMessage': {
      const { alias } = await requireGrantedAlias(origin);
      const msgB64 = (params as { message?: string }).message;
      if (typeof msgB64 !== 'string') throw new DappError(ERR.UNSUPPORTED, 'Missing message');
      const request: MsgApprovalRequest = {
        requestId: uid(),
        origin,
        aliasId: alias.id,
        messageBase64: msgB64,
        tabId,
      };
      const outcome = await askUser<{ approved: boolean }>({ kind: 'msg', request });
      if (!outcome.approved) throw new DappError(ERR.USER_REJECTED, 'Signature request was declined');
      const keypair = await aliases.aliasKeypairById(alias.id);
      const signature = nacl.sign.detached(b64ToBytes(msgB64), keypair.secretKey);
      return { signature: bytesToB64(signature), publicKey: alias.address };
    }

    // ---------- companion page (external main wallet) ----------
    case 'companionReady': {
      const opId = (params as { opId?: string }).opId;
      if (typeof opId !== 'string') throw new DappError(ERR.UNSUPPORTED, 'Missing opId');
      const record = await journal.getOperation(opId);
      if (!record) throw new DappError(ERR.UNAUTHORIZED, 'Unknown operation');
      registerCompanionTab(opId, tabId);
      return { amountLamports: record.amountLamports, kind: record.kind };
    }
    case 'companionWallet': {
      const { opId, address, walletName } = params as { opId?: string; address?: string; walletName?: string };
      if (typeof opId !== 'string' || typeof address !== 'string') {
        throw new DappError(ERR.UNSUPPORTED, 'Missing wallet details');
      }
      if (companionTabFor(opId) !== tabId) throw new DappError(ERR.UNAUTHORIZED, 'Wrong tab for this operation');
      new PublicKey(address); // validate
      resolveCompanion(opId, 'pick-wallet', true, { address, walletName: walletName ?? 'Wallet' });
      return true;
    }
    case 'companionSigned': {
      const { opId, signedTxB64 } = params as { opId?: string; signedTxB64?: string };
      if (typeof opId !== 'string' || typeof signedTxB64 !== 'string') {
        throw new DappError(ERR.UNSUPPORTED, 'Missing signed transaction');
      }
      if (companionTabFor(opId) !== tabId) throw new DappError(ERR.UNAUTHORIZED, 'Wrong tab for this operation');
      resolveCompanion(opId, 'sign', true, { signedTxB64 });
      return true;
    }
    case 'companionError': {
      const { opId, task, message } = params as { opId?: string; task?: string; message?: string };
      if (typeof opId !== 'string') throw new DappError(ERR.UNSUPPORTED, 'Missing opId');
      if (companionTabFor(opId) !== tabId) throw new DappError(ERR.UNAUTHORIZED, 'Wrong tab for this operation');
      resolveCompanion(opId, task === 'sign' ? 'sign' : 'pick-wallet', false, message ?? 'Wallet step failed');
      return true;
    }

    default:
      throw new DappError(ERR.UNSUPPORTED, `Unsupported method: ${msg.method}`);
  }
}

// Deliver companion tasks through the tab's relay port.
const relayPorts = new Map<number, chrome.runtime.Port>();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'alias-relay') return;
  const tabId = port.sender?.tab?.id;
  if (tabId === undefined) return;
  relayPorts.set(tabId, port);
  port.onDisconnect.addListener(() => {
    if (relayPorts.get(tabId) === port) relayPorts.delete(tabId);
  });
});
setCompanionDeliverer((tabId, task) => {
  const port = relayPorts.get(tabId);
  if (!port) return false;
  try {
    port.postMessage({ event: 'companionTask', data: task });
    return true;
  } catch {
    return false;
  }
});

// ---------- housekeeping ----------
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'auto-lock') {
    void vault.lock();
  }
  // A scheduled payout is due: put a small badge on the toolbar icon. The
  // payout itself only runs when the user opens it (it needs the unlocked vault).
  if (alarm.name.startsWith('pay:')) {
    void chrome.action.setBadgeBackgroundColor({ color: '#3FA37A' });
    void chrome.action.setBadgeText({ text: '1' });
  }
});
