import { markSvg } from '../src/shared/brand';
// Alias funding companion: a plain web page where installed wallets (Phantom,
// Solflare, ...) actually live. It discovers them through the Wallet Standard,
// lets the user pick one, and signs the deposit transaction the extension
// built. It holds no keys and no secrets; it only ever sees one unsigned
// transaction and returns the signed bytes to the extension.

interface WalletAccount {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
}

interface StandardWallet {
  name: string;
  icon: string;
  chains: readonly string[];
  accounts: readonly WalletAccount[];
  features: Record<string, Record<string, unknown>>;
}

interface CompanionTaskMsg {
  opId: string;
  task: string;
  txBase64?: string;
  text?: string;
  state?: 'working' | 'failed' | 'done';
}

interface AliasBridge {
  companionReady: (opId: string) => Promise<{ amountLamports: number; kind: string }>;
  companionWallet: (opId: string, address: string, walletName: string) => Promise<unknown>;
  companionSigned: (opId: string, signedTxB64: string) => Promise<unknown>;
  companionError: (opId: string, task: string, message: string) => Promise<unknown>;
  onCompanionTask: (listener: (task: CompanionTaskMsg) => void) => () => void;
}

const panel = document.getElementById('panel')!;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function show(html: string): void {
  panel.innerHTML = html;
}

function statusCard(text: string, spinning = true): string {
  return `<div class="status card">${spinning ? '<div class="spin"></div>' : ''}<span class="muted">${esc(text)}</span></div>`;
}

function head(title: string, sub: string): string {
  return `<div class="head">
    ${markSvg(40)}
    <div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>
  </div>`;
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

function lamportsToSol(l: number): string {
  return (l / 1e9).toLocaleString('en-US', { maximumFractionDigits: 9 });
}

// ---------- Wallet Standard discovery (hand-rolled, no dependency) ----------
const discovered = new Map<string, StandardWallet>();
let discoveryStarted = false;

function considerWallet(wallet: StandardWallet): void {
  if (!wallet || typeof wallet.name !== 'string') return;
  if (wallet.name === 'Alias') return; // never offer Alias as its own main wallet
  const features = wallet.features ?? {};
  const canConnect = 'standard:connect' in features;
  const canSign = 'solana:signTransaction' in features;
  const solanaChains = (wallet.chains ?? []).some((c) => String(c).startsWith('solana:'));
  if (canConnect && canSign && solanaChains) discovered.set(wallet.name, wallet);
}

function startDiscovery(onChange: () => void): void {
  if (discoveryStarted) {
    onChange();
    return;
  }
  discoveryStarted = true;
  window.addEventListener('wallet-standard:register-wallet', ((event: CustomEvent) => {
    const callback = event.detail as unknown;
    if (typeof callback === 'function') {
      (callback as (api: { register: (...wallets: StandardWallet[]) => void }) => void)({
        register: (...wallets: StandardWallet[]) => {
          wallets.forEach(considerWallet);
          onChange();
        },
      });
    }
    return undefined;
  }) as EventListener);
  try {
    window.dispatchEvent(
      new CustomEvent('wallet-standard:app-ready', {
        detail: {
          register: (...wallets: StandardWallet[]) => {
            wallets.forEach(considerWallet);
            onChange();
          },
        },
      }),
    );
  } catch {
    // Discovery stays empty; the page shows what to do.
  }
}

// ---------- page flow ----------
async function waitForBridge(timeoutMs: number): Promise<AliasBridge> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const bridge = (window as unknown as { alias?: AliasBridge }).alias;
    if (bridge) return bridge;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('bridge-missing');
}

// Live progress from the Alias operation window. While Phantom is asking for
// a signature, the signing screen stays in place.
let signing = false;
function showStatus(text: string, state: 'working' | 'failed' | 'done'): void {
  if (signing && state === 'working') return;
  const title = state === 'failed' ? 'Something went wrong' : state === 'done' ? 'Done' : 'Working on it';
  const sub =
    state === 'failed'
      ? 'Details are in the Alias window too.'
      : state === 'done'
        ? 'You can close this tab.'
        : 'Live progress from the Alias window.';
  show(
    head(title, sub) +
      `<div class="card" style="padding:14px 16px;font-size:14px;line-height:1.5;${state === 'failed' ? 'color:#b3402a;font-weight:700' : ''}">
        ${state === 'working' ? '<div class="spin" style="display:inline-block;vertical-align:middle;margin-right:8px"></div>' : ''}${esc(text)}
      </div>` +
      (state === 'failed'
        ? `<p class="muted" style="font-size:13px">Close this tab and start again from Alias when you are ready. Anything already sent is listed in Alias History.</p>`
        : ''),
  );
}

let chosenWallet: StandardWallet | null = null;
let chosenAccount: WalletAccount | null = null;

async function main(): Promise<void> {
  const match = /(?:^|[#&])op=([a-zA-Z0-9_-]+)/.exec(location.hash);
  const opId = match?.[1];
  if (!opId) {
    show(head('Alias funding page', 'This page is opened by the Alias extension.') + statusCard('No operation to run. Start "Fund privately" from the Alias extension.', false));
    return;
  }

  let bridge: AliasBridge;
  try {
    bridge = await waitForBridge(6000);
  } catch {
    show(
      head('Alias funding page', 'The Alias extension did not answer.') +
        `<div class="card" style="padding:14px 16px;font-size:14px;line-height:1.5">
          Chrome did not inject the Alias bridge into this page. Check that the Alias extension is installed and enabled,
          then reload this page. If you just installed it, reload once more.
        </div>
        <button class="btn btn-primary" id="reload">Reload</button>`,
    );
    document.getElementById('reload')?.addEventListener('click', () => location.reload());
    return;
  }

  let op: { amountLamports: number; kind: string };
  try {
    op = await bridge.companionReady(opId);
  } catch (e) {
    show(head('Alias funding page', 'This operation is not available.') + statusCard((e as Error).message, false));
    return;
  }

  // React to tasks from the extension (the signature request arrives later).
  bridge.onCompanionTask((task) => {
    if (task.opId !== opId) return;
    if (task.task === 'pick-wallet' && !chosenAccount) renderWalletPicker(bridge, opId, op);
    if (task.task === 'sign' && task.txBase64) void signWithWallet(bridge, opId, op, task.txBase64);
    if (task.task === 'status' && task.text) showStatus(task.text, task.state ?? 'working');
  });

  renderWalletPicker(bridge, opId, op);
}

function renderWalletPicker(bridge: AliasBridge, opId: string, op: { amountLamports: number; kind: string }): void {
  const render = () => {
    const wallets = [...discovered.values()];
    show(
      head('Fund privately', 'Pick the wallet that will deposit into Privacy Cash.') +
        `<div class="big-amount">${lamportsToSol(op.amountLamports)} SOL</div>` +
        (wallets.length
          ? `<div class="wallets">${wallets
              .map(
                (w, i) =>
                  `<button class="wallet-btn" data-i="${i}"><img src="${esc(w.icon)}" alt="" /><span>${esc(w.name)}</span></button>`,
              )
              .join('')}</div>
             <p class="muted" style="font-size:12.5px">Your wallet only signs its own deposit. Alias never sees its keys.</p>`
          : statusCard('Looking for installed wallets… Install Phantom or Solflare if none appear.')),
    );
    panel.querySelectorAll<HTMLButtonElement>('.wallet-btn').forEach((btn) => {
      btn.addEventListener('click', () => void pickWallet(bridge, opId, wallets[Number(btn.dataset.i)]));
    });
  };
  startDiscovery(render);
  render();
}

async function pickWallet(bridge: AliasBridge, opId: string, wallet: StandardWallet): Promise<void> {
  show(head('Fund privately', `Connecting to ${wallet.name}…`) + statusCard(`Approve the connection in ${wallet.name}.`));
  try {
    const connectFeature = wallet.features['standard:connect'] as {
      connect: (input?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }>;
    };
    const { accounts } = await connectFeature.connect();
    const account = accounts.find((a) => a.chains.some((c) => String(c).startsWith('solana:'))) ?? accounts[0];
    if (!account) throw new Error(`${wallet.name} returned no account`);
    chosenWallet = wallet;
    chosenAccount = account;
    await bridge.companionWallet(opId, account.address, wallet.name);
    show(
      head('Fund privately', `${wallet.name} connected.`) +
        statusCard('Alias is preparing the private deposit in its own small window (it may be behind this one). Keep this tab open: Phantom asks you to sign here next.'),
    );
  } catch (e) {
    const message = (e as Error).message || `Could not connect to ${wallet.name}`;
    await bridge.companionError(opId, 'pick-wallet', message).catch(() => undefined);
    show(head('Fund privately', 'The wallet connection failed.') + statusCard(message, false) + `<button class="btn btn-primary" id="again">Try again</button>`);
    document.getElementById('again')?.addEventListener('click', () => location.reload());
  }
}

async function signWithWallet(
  bridge: AliasBridge,
  opId: string,
  op: { amountLamports: number; kind: string },
  txBase64: string,
): Promise<void> {
  if (!chosenWallet || !chosenAccount) {
    await bridge.companionError(opId, 'sign', 'No wallet is connected on the funding page. Reload it and start again.').catch(() => undefined);
    return;
  }
  signing = true;
  show(
    head('Approve the deposit', `${chosenWallet.name} will ask you to sign.`) +
      `<div class="big-amount">${lamportsToSol(op.amountLamports)} SOL</div>` +
      statusCard(`Review and approve the deposit in ${chosenWallet.name}. It goes to the Privacy Cash pool, not to any website.`),
  );
  try {
    const signFeature = chosenWallet.features['solana:signTransaction'] as {
      signTransaction: (
        ...inputs: { transaction: Uint8Array; account: WalletAccount; chain?: string }[]
      ) => Promise<readonly { signedTransaction: Uint8Array }[]>;
    };
    const chain = chosenAccount.chains.find((c) => String(c).startsWith('solana:')) ?? 'solana:mainnet';
    const [result] = await signFeature.signTransaction({
      transaction: b64ToBytes(txBase64),
      account: chosenAccount,
      chain: String(chain),
    });
    if (!result?.signedTransaction) throw new Error('The wallet returned no signature');
    await bridge.companionSigned(opId, bytesToB64(result.signedTransaction));
    signing = false;
    show(
      head('Deposit signed', 'Back to Alias.') +
        `<div class="card" style="padding:14px 16px;font-size:14px;line-height:1.5">
          Alias is submitting the deposit and will pay your alias from the pool.
          You can watch the progress in the Alias operation window. This tab can be closed.
        </div>`,
    );
  } catch (e) {
    signing = false;
    const message = (e as Error).message || 'The wallet did not sign';
    await bridge.companionError(opId, 'sign', message).catch(() => undefined);
    show(
      head('Deposit not signed', 'Nothing was sent.') +
        statusCard(message, false) +
        `<div class="card" style="padding:12px 14px;font-size:13.5px" >You can close this tab and start the funding again from Alias.</div>`,
    );
  }
}

void main();
