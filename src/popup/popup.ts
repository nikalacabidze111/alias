// Alias popup: onboarding, home, approvals, funding, settings.
import {
  bgCall,
  type AliasInfo,
  type OperationRecord,
  type SettingsState,
  type SimulationResult,
  type VaultStatus,
} from '../shared/messages';
import type { ApprovalPayload } from '../background/approvals';
import { PRIVACY_CASH_RELAYER, type AliasKind } from '../shared/constants';
import { formatWhen, lamportsToSol, shortAddress, solToLamports, timeAgo } from '../shared/format';

const app = document.getElementById('app')!;

// ---------- tiny helpers ----------
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function screen(html: string, opts: { scroll?: boolean } = {}): void {
  app.innerHTML = `<div class="screen${opts.scroll ? ' screen-scroll' : ''}">${html}</div>`;
}

function on(selector: string, event: string, handler: (e: Event, el: HTMLElement) => void): void {
  app.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.addEventListener(event, (e) => handler(e, el));
  });
}

function val(selector: string): string {
  return (app.querySelector(selector) as HTMLInputElement | null)?.value ?? '';
}

function mascot(size = 84): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="33" r="21" fill="#FFE9B8"/>
    <rect x="8" y="24.5" width="48" height="14" rx="7" fill="var(--lilac)"/>
    <circle cx="23.5" cy="31.5" r="3.6" fill="var(--ink)"/>
    <circle cx="40.5" cy="31.5" r="3.6" fill="var(--ink)"/>
    <path d="M25 45c2.4 2.8 11.6 2.8 14 0" stroke="var(--ink)" stroke-width="2.8" stroke-linecap="round" fill="none"/>
  </svg>`;
}

function avatar(seed: number, size = 34): string {
  const hue = seed % 360;
  const band = `hsl(${hue} 55% 75%)`;
  const face = `hsl(${(hue + 40) % 360} 85% 88%)`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="${face}"/>
    <rect x="6" y="23" width="52" height="15" rx="7.5" fill="${band}"/>
    <circle cx="23" cy="30.5" r="3.6" fill="#211D17"/>
    <circle cx="41" cy="30.5" r="3.6" fill="#211D17"/>
  </svg>`;
}

function topbar(title: string, backRoute?: string): string {
  return `<div class="topbar">
    ${backRoute ? `<button class="back" data-nav="${backRoute}">‹ Back</button>` : '<span></span>'}
    <span class="title">${esc(title)}</span>
    <span style="width:44px"></span>
  </div>`;
}

async function bg<T>(req: Parameters<typeof bgCall>[0]): Promise<T> {
  const res = await bgCall<T>(req);
  if (!res.ok) throw new Error(res.error?.message ?? 'Something went wrong');
  return res.result as T;
}

function wireNav(): void {
  on('[data-nav]', 'click', (_e, el) => {
    location.hash = el.dataset.nav!;
  });
}

function showError(message: string): void {
  const slot = app.querySelector('.error-text');
  if (slot) slot.textContent = message;
}

// ---------- state ----------
let aliasList: AliasInfo[] = [];
let settings: SettingsState | null = null;
let selectedAliasId: string | null = localStorage.getItem('alias.selected');

function currentAlias(): AliasInfo | null {
  return aliasList.find((a) => a.id === selectedAliasId) ?? aliasList[0] ?? null;
}

async function refreshCore(): Promise<void> {
  [aliasList, settings] = await Promise.all([bg<AliasInfo[]>({ type: 'alias.list' }), bg<SettingsState>({ type: 'settings.get' })]);
}

// ---------- router ----------
async function route(): Promise<void> {
  const hash = location.hash.replace(/^#/, '') || '/';
  const isApproval = hash.startsWith('/approve/');
  document.body.classList.toggle('windowed', isApproval);

  const status = await bg<VaultStatus>({ type: 'vault.status' });

  if (!status.exists) {
    if (hash === '/onboard/password') return renderOnboardPassword();
    if (hash === '/onboard/import') return renderOnboardImport();
    return renderWelcome();
  }
  if (!status.unlocked) return renderUnlock(hash);

  await refreshCore();

  if (isApproval) return renderApproval(hash.split('/')[2]);
  if (hash === '/create-alias') return renderCreateAlias();
  if (hash === '/fund') return renderFund();
  if (hash === '/return') return renderReturn();
  if (hash === '/settings') return renderSettings();
  if (hash === '/settings/mainnet') return renderMainnetConsent();
  if (hash === '/settings/sites') return renderSites();
  if (hash === '/settings/phrase') return renderRevealPhrase();
  if (hash === '/history') return renderHistory();
  if (hash === '/aliases') return renderAliases();
  if (hash.startsWith('/phrase-backup')) return renderPhraseBackup();
  if (aliasList.length === 0) return renderCreateAlias(true);
  return renderHome();
}

window.addEventListener('hashchange', () => void route());

// ---------- onboarding ----------
function renderWelcome(): void {
  screen(`
    <div class="grow" style="display:flex;flex-direction:column;justify-content:center">
      <div class="hero">
        ${mascot(96)}
        <h1>Alias</h1>
        <p>Separate wallet identities for different apps. Your main wallet stays separate.</p>
      </div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" data-nav="/onboard/password">Create my vault</button>
      <button class="btn btn-ghost" data-nav="/onboard/import">I have a recovery phrase</button>
    </div>
  `);
  wireNav();
}

function renderOnboardPassword(): void {
  screen(`
    ${topbar('Set a password', '/')}
    <div class="stack">
      <p class="muted">This password unlocks Alias on this computer. It never leaves your device.</p>
      <input id="pw1" class="field" type="password" placeholder="Password (8+ characters)" autocomplete="new-password" />
      <input id="pw2" class="field" type="password" placeholder="Repeat password" autocomplete="new-password" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="create">Continue</button>
    </div>
  `);
  wireNav();
  on('#create', 'click', async () => {
    const p1 = val('#pw1');
    const p2 = val('#pw2');
    if (p1 !== p2) return showError('The passwords do not match');
    try {
      const { mnemonic } = await bg<{ mnemonic: string }>({ type: 'vault.create', password: p1 });
      sessionStorage.setItem('alias.new-mnemonic', mnemonic);
      location.hash = '/phrase-backup';
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

function renderPhraseBackup(): void {
  const mnemonic = sessionStorage.getItem('alias.new-mnemonic') ?? '';
  const words = mnemonic.split(' ');
  screen(`
    ${topbar('Your recovery phrase')}
    <div class="stack">
      <p class="muted small">These 12 words recover every alias and its funds. Write them down and keep them offline. This is the one recovery step.</p>
      <div class="phrase-grid">
        ${words.map((w, i) => `<div class="phrase-word"><i>${i + 1}</i>${esc(w)}</div>`).join('')}
      </div>
      <label class="check-row"><input type="checkbox" id="saved" /> I wrote these 12 words down somewhere safe.</label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="done">Continue</button>
    </div>
  `);
  on('#done', 'click', () => {
    if (!(app.querySelector('#saved') as HTMLInputElement).checked) {
      return showError('Please confirm you wrote the phrase down');
    }
    sessionStorage.removeItem('alias.new-mnemonic');
    location.hash = '/create-alias';
  });
}

function renderOnboardImport(): void {
  screen(`
    ${topbar('Restore from phrase', '/')}
    <div class="stack">
      <textarea id="mn" class="field" rows="3" placeholder="Enter your 12 or 24 word recovery phrase"></textarea>
      <input id="pw1" class="field" type="password" placeholder="New password (8+ characters)" autocomplete="new-password" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="restore">Restore</button>
    </div>
  `);
  wireNav();
  on('#restore', 'click', async () => {
    try {
      await bg({ type: 'vault.importMnemonic', password: val('#pw1'), mnemonic: val('#mn') });
      location.hash = '/create-alias';
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

function renderUnlock(nextHash: string): void {
  screen(`
    <div class="grow" style="display:flex;flex-direction:column;justify-content:center">
      <div class="hero">
        ${mascot(84)}
        <h1>Welcome back</h1>
      </div>
      <div class="stack" style="margin-top:14px">
        <input id="pw" class="field" type="password" placeholder="Password" autocomplete="current-password" />
        <div class="error-text"></div>
      </div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="unlock">Unlock</button>
    </div>
  `);
  const go = async () => {
    try {
      await bg({ type: 'vault.unlock', password: val('#pw') });
      location.hash = nextHash === '/' ? '' : `#${nextHash}`;
      void route();
    } catch (e) {
      showError((e as Error).message);
    }
  };
  on('#unlock', 'click', go);
  on('#pw', 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void go();
  });
  (app.querySelector('#pw') as HTMLInputElement).focus();
}

// ---------- home ----------
async function renderHome(): Promise<void> {
  const alias = currentAlias();
  if (!alias) return renderCreateAlias(true);
  selectedAliasId = alias.id;
  localStorage.setItem('alias.selected', alias.id);

  const net = settings!.network;
  const netChip =
    net === 'mainnet-beta'
      ? `<span class="chip chip-coral">Mainnet</span>`
      : `<span class="chip chip-amber">Devnet</span>`;

  screen(`
    <div class="topbar">
      <span class="title">Alias</span>
      ${netChip}
    </div>
    <div class="stack">
      <div class="alias-card">
        <div class="row">
          ${avatar(alias.avatarSeed)}
          <div style="flex:1;min-width:0">
            <div class="alias-name">${esc(alias.name)}</div>
            <div id="site-chip"></div>
          </div>
        </div>
        <div class="alias-balance mono" id="balance">…</div>
        <div class="row" style="justify-content:space-between">
          <button class="addr" id="copy-addr" title="${esc(alias.address)}">${shortAddress(alias.address, 5, 5)} ⧉</button>
          <span class="small" style="color:var(--lilac-ink);font-weight:700">No direct public funding link</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-mint" data-nav="/fund">Fund privately</button>
        <button class="btn btn-soft" data-nav="/return">Return privately</button>
      </div>
      <div id="pending"></div>
      <div class="alias-switch" id="switch">
        ${pillAliases(alias)
          .map(
            (a) =>
              `<button class="alias-pill${a.id === alias.id ? ' active' : ''}" data-alias="${a.id}" title="${esc(a.name)}">${avatar(a.avatarSeed, 18)} <span class="pill-name">${esc(a.name)}</span></button>`,
          )
          .join('')}
        ${aliasList.length > PILL_LIMIT ? `<button class="alias-pill" data-nav="/aliases">All ${aliasList.length}</button>` : ''}
        <button class="alias-pill" data-nav="/create-alias">＋ New</button>
      </div>
    </div>
    <div class="bottom">
      <div class="nav">
        <button class="active">Home</button>
        <button data-nav="/history">History</button>
        <button data-nav="/settings">Settings</button>
      </div>
    </div>
  `);
  wireNav();
  on('[data-alias]', 'click', (_e, el) => {
    selectedAliasId = el.dataset.alias!;
    localStorage.setItem('alias.selected', selectedAliasId);
    void renderHome();
  });
  on('#copy-addr', 'click', async (_e, el) => {
    await navigator.clipboard.writeText(alias.address);
    el.textContent = 'Copied!';
    setTimeout(() => (el.innerHTML = `${shortAddress(alias.address, 5, 5)} ⧉`), 900);
  });

  // Real balance.
  bg<{ lamports: number }>({ type: 'alias.balance', id: alias.id })
    .then(({ lamports }) => {
      const b = app.querySelector('#balance');
      if (b) b.textContent = `${lamportsToSol(lamports)} SOL`;
    })
    .catch(() => {
      const b = app.querySelector('#balance');
      if (b) b.textContent = 'Balance unavailable';
    });

  // A deposit that is in the pool but not paid out yet (scheduled, or a
  // payout that was interrupted). One card, one action.
  bg<OperationRecord[]>({ type: 'ops.list' })
    .then((ops) => {
      const now = Date.now();
      const waiting = ops.filter((o) => o.step === 'deposit-confirmed' && !o.withdrawTx);
      const ready = waiting.filter((o) => !o.payAfter || o.payAfter <= now);
      if (ready.length === 0) void chrome.action?.setBadgeText({ text: '' }).catch(() => undefined);
      const op = ready[0] ?? waiting[0];
      const slot = app.querySelector('#pending');
      if (!op || !slot) return;
      const isReady = !op.payAfter || op.payAfter <= now;
      const payee = op.kind === 'fund' ? (aliasList.find((a) => a.id === op.aliasId)?.name ?? 'your alias') : 'your main wallet';
      slot.innerHTML = `<div class="card pending${isReady ? ' ready' : ''}">
        <div class="meta">
          <div class="one">${lamportsToSol(op.amountLamports)} SOL ${isReady ? 'ready in the pool' : 'waiting in the pool'}</div>
          <div class="two">${isReady ? `Next: pay ${esc(payee)}` : `Pays ${esc(payee)} ${esc(formatWhen(op.payAfter!))}`}</div>
        </div>
        <button class="btn-mini" id="pay-op">${isReady ? 'Pay' : 'Pay now'}</button>
      </div>`;
      on('#pay-op', 'click', async () => {
        try {
          await bg({ type: 'ops.open', id: op.id, payNow: true });
          window.close();
        } catch {
          // The card stays; History can reopen it too.
        }
      });
    })
    .catch(() => undefined);

  // Connected-site chip for the active tab.
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url?.startsWith('http')) {
      const origin = new URL(tab.url).origin;
      const grants = await bg<{ origin: string; aliasId: string }[]>({ type: 'origins.list' });
      const grant = grants.find((g) => g.origin === origin);
      const slot = app.querySelector('#site-chip');
      if (slot && grant) {
        const who = aliasList.find((a) => a.id === grant.aliasId);
        slot.innerHTML = `<span class="chip chip-mint">Connected to ${esc(new URL(origin).hostname)}${
          who && who.id !== alias.id ? ` as ${esc(who.name)}` : ''
        }</span>`;
      }
    }
  } catch {
    // No tab access; skip the chip.
  }
}

// Home shows at most PILL_LIMIT aliases: the current one plus the newest.
const PILL_LIMIT = 3;
function pillAliases(current: AliasInfo): AliasInfo[] {
  const others = aliasList.filter((a) => a.id !== current.id).sort((a, b) => b.createdAt - a.createdAt);
  return [current, ...others.slice(0, PILL_LIMIT - 1)];
}

// ---------- all aliases (paginated, no scrolling) ----------
const ALIASES_PER_PAGE = 5;
function renderAliases(page = 0): void {
  const pages = Math.max(1, Math.ceil(aliasList.length / ALIASES_PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = aliasList.slice(page * ALIASES_PER_PAGE, (page + 1) * ALIASES_PER_PAGE);
  const current = currentAlias();
  screen(`
    ${topbar('Your aliases', '/')}
    <div class="stack grow">
      ${slice
        .map(
          (a) => `<button class="card list-item" data-alias="${a.id}" style="text-align:left;${a.id === current?.id ? 'border-color:var(--lilac);background:var(--lilac-soft)' : ''}">
            ${avatar(a.avatarSeed, 28)}
            <div class="meta"><div class="one">${esc(a.name)}</div><div class="two mono" title="${esc(a.address)}">${shortAddress(a.address, 5, 5)}</div></div>
          </button>`,
        )
        .join('')}
      ${
        pages > 1
          ? `<div class="pager"><button class="link-btn" id="prev" ${page === 0 ? 'disabled' : ''}>Previous</button><span>${page + 1} / ${pages}</span><button class="link-btn" id="next" ${page === pages - 1 ? 'disabled' : ''}>Next</button></div>`
          : ''
      }
    </div>
    <div class="bottom">
      <button class="btn btn-soft" data-nav="/create-alias">＋ New alias</button>
    </div>
  `);
  wireNav();
  on('[data-alias]', 'click', (_e, el) => {
    selectedAliasId = el.dataset.alias!;
    localStorage.setItem('alias.selected', selectedAliasId);
    location.hash = '/';
  });
  on('#prev', 'click', () => renderAliases(page - 1));
  on('#next', 'click', () => renderAliases(page + 1));
}

// ---------- create alias ----------
function renderCreateAlias(first = false): void {
  let kind: AliasKind = 'trading';
  screen(`
    ${topbar(first ? 'Create your first alias' : 'New alias', first ? undefined : '/')}
    <div class="stack">
      <p class="muted small">${first ? 'An alias is a separate wallet identity. Start with one for trading.' : 'Each alias is a separate identity with its own address.'}</p>
      <div class="kind-grid" id="kinds">
        <button class="kind-option active" data-kind="trading"><strong>Trading</strong><span>DEXes and swaps</span></button>
        <button class="kind-option" data-kind="collecting"><strong>Collecting</strong><span>NFT apps</span></button>
        <button class="kind-option" data-kind="everyday"><strong>Everyday</strong><span>General use</span></button>
        <button class="kind-option" data-kind="fresh"><strong>Fresh</strong><span>One site only</span></button>
      </div>
      <input id="name" class="field" placeholder="Name (optional)" />
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="create">Create alias</button>
    </div>
  `);
  wireNav();
  on('[data-kind]', 'click', (_e, el) => {
    kind = el.dataset.kind as AliasKind;
    app.querySelectorAll('.kind-option').forEach((o) => o.classList.remove('active'));
    el.classList.add('active');
  });
  on('#create', 'click', async () => {
    try {
      const info = await bg<AliasInfo>({ type: 'alias.create', name: val('#name'), kind });
      selectedAliasId = info.id;
      localStorage.setItem('alias.selected', info.id);
      location.hash = '';
      void route();
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

// ---------- fund / return ----------
interface FeeConfig {
  withdraw_fee_rate: number;
  withdraw_rent_fee_sol: number; // the relayer reports this in SOL
  minimum_sol?: number;
}

async function fetchFeeConfig(): Promise<FeeConfig | null> {
  try {
    const res = await fetch(`${PRIVACY_CASH_RELAYER}/config`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      withdraw_fee_rate?: number;
      withdraw_rent_fee?: number;
      minimum_withdrawal?: Record<string, number>;
    };
    if (typeof json.withdraw_fee_rate !== 'number' || typeof json.withdraw_rent_fee !== 'number') return null;
    return {
      withdraw_fee_rate: json.withdraw_fee_rate,
      withdraw_rent_fee_sol: json.withdraw_rent_fee,
      minimum_sol: typeof json.minimum_withdrawal?.sol === 'number' ? json.minimum_withdrawal.sol : undefined,
    };
  } catch {
    return null;
  }
}

function poolFeeLamports(lam: number, config: FeeConfig): number {
  // Mirrors the SDK: floor(amount * rate + rent_fee_in_sol * 1e9).
  return Math.floor(lam * config.withdraw_fee_rate + config.withdraw_rent_fee_sol * 1e9);
}

// ---------- payout timing ----------
// When the pool pays out after the deposit confirms. The last choice is a
// per-browser convenience only.
const DELAY_KEY = 'alias.payoutDelay';
const DELAYS = [0, 60, 1440];

function savedDelay(): number {
  try {
    const v = Number(localStorage.getItem(DELAY_KEY));
    return DELAYS.includes(v) ? v : 0;
  } catch {
    return 0;
  }
}

function timingControl(): string {
  return `<div class="seg" id="when" role="group" aria-label="When the pool pays out">
    <button data-delay="0">Right away</button>
    <button data-delay="60">In 1 hour</button>
    <button data-delay="1440">Tomorrow</button>
  </div>
  <p class="small muted when-note" id="when-note"></p>`;
}

// Wires the segmented control; returns a getter for the chosen delay (minutes).
function wireTiming(): () => number {
  let delay = savedDelay();
  const paint = () => {
    app.querySelectorAll<HTMLElement>('#when [data-delay]').forEach((b) => {
      const active = Number(b.dataset.delay) === delay;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const note = app.querySelector('#when-note');
    if (note) {
      note.textContent =
        delay === 0
          ? 'Fastest, but a deposit and a payout of almost the same amount minutes apart are easier to match.'
          : 'Your SOL waits in the pool until then. Spacing the two transactions out makes them harder to match.';
    }
  };
  on('#when [data-delay]', 'click', (_e, el) => {
    delay = Number(el.dataset.delay);
    try {
      localStorage.setItem(DELAY_KEY, String(delay));
    } catch {
      // Not remembered; still used for this operation.
    }
    paint();
  });
  paint();
  return () => delay;
}

function privacyGate(): string | null {
  if (settings!.network !== 'mainnet-beta' || !settings!.mainnetEnabled) {
    return `Privacy Cash runs on Solana mainnet only. Enable mainnet in Settings to fund privately.`;
  }
  return null;
}

async function renderFund(): Promise<void> {
  const alias = currentAlias()!;
  const gate = privacyGate();
  screen(`
    ${topbar('Fund privately', '/')}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias.avatarSeed)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">receives through Privacy Cash</div></div></div>
      ${
        gate
          ? `<div class="notice amber">${esc(gate)}</div>`
          : `
      <div class="amount-input"><input id="amount" inputmode="decimal" placeholder="0.05" /><span class="unit">SOL</span></div>
      <div class="card" style="padding:11px 13px">
        <div class="kv"><span class="k">From</span><span class="v">Your main wallet (chosen next)</span></div>
        <div class="kv"><span class="k">Pool fee (estimate)</span><span class="v" id="fee">…</span></div>
        <div class="kv"><span class="k">Alias receives (estimate)</span><span class="v" id="net">…</span></div>
      </div>
      <div class="small" style="font-weight:800">Pool pays the alias</div>
      ${timingControl()}
      <div class="error-text"></div>`
      }
    </div>
    <div class="bottom">
      ${gate ? `<button class="btn btn-primary" data-nav="/settings/mainnet">Enable mainnet</button>` : `<button class="btn btn-primary" id="go">Continue</button>`}
    </div>
  `);
  wireNav();
  if (gate) return;
  const getDelay = wireTiming();

  const config = await fetchFeeConfig();
  const update = () => {
    const lam = solToLamports(val('#amount') || '0');
    const feeEl = app.querySelector('#fee');
    const netEl = app.querySelector('#net');
    if (!feeEl || !netEl) return;
    if (!config) {
      feeEl.textContent = 'unavailable';
      netEl.textContent = 'unavailable';
      return;
    }
    if (!(lam > 0)) {
      feeEl.textContent = '-';
      netEl.textContent = '-';
      return;
    }
    const fee = poolFeeLamports(lam, config);
    const min = config.minimum_sol !== undefined ? solToLamports(config.minimum_sol) : 0;
    if (min && lam < min) {
      feeEl.textContent = `min ${config.minimum_sol} SOL`;
      netEl.textContent = '-';
      return;
    }
    feeEl.textContent = `≈ ${lamportsToSol(fee)} SOL`;
    netEl.textContent = `≈ ${lamportsToSol(Math.max(0, lam - fee))} SOL`;
  };
  on('#amount', 'input', update);
  update();

  on('#go', 'click', async () => {
    const lam = solToLamports(val('#amount'));
    if (!(lam > 0)) return showError('Enter an amount first');
    if (!config) return showError('Could not load live Privacy Cash fees. Check your connection and try again.');
    try {
      await bg<OperationRecord>({
        type: 'ops.start',
        kind: 'fund',
        aliasId: alias.id,
        amountLamports: lam,
        delayMinutes: getDelay(),
      });
      screen(`
        <div class="grow" style="display:flex;align-items:center;justify-content:center">
          <div class="hero">${mascot(84)}<h1>Continue in the Alias window</h1><p>The funding steps run in the small window that just opened.</p></div>
        </div>
        <div class="bottom"><button class="btn btn-soft" data-nav="/">Done</button></div>`);
      wireNav();
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

async function renderReturn(): Promise<void> {
  const alias = currentAlias()!;
  const gate = privacyGate();
  let balance = 0;
  try {
    balance = (await bg<{ lamports: number }>({ type: 'alias.balance', id: alias.id })).lamports;
  } catch {
    // Shown as 0; the send step would fail honestly anyway.
  }
  // The main wallet that funded through Alias most recently is the default
  // destination, so returning never needs a pasted address.
  let known: { address: string; name?: string } | null = null;
  try {
    const ops = await bg<OperationRecord[]>({ type: 'ops.list' });
    const funded = ops.find((o) => o.kind === 'fund' && o.mainWallet);
    if (funded?.mainWallet) known = { address: funded.mainWallet, name: funded.mainWalletName };
  } catch {
    // No history yet; the address field is shown instead.
  }
  screen(`
    ${topbar('Return privately', '/')}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias.avatarSeed)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">has ${lamportsToSol(balance)} SOL</div></div></div>
      ${
        gate
          ? `<div class="notice amber">${esc(gate)}</div>`
          : `
      ${
        known
          ? `<div class="card dest-known" id="dest-known">
              <div class="meta"><div class="one">To your main wallet</div><div class="two mono" title="${esc(known.address)}">${known.name ? `${esc(known.name)} · ` : ''}${esc(shortAddress(known.address, 5, 5))}</div></div>
              <button class="link-btn" id="dest-change">Change</button>
            </div>`
          : ''
      }
      <input id="dest" class="field" placeholder="Destination address (your main wallet)" value="${known ? esc(known.address) : ''}" ${known ? 'hidden' : ''} />
      <div class="amount-input"><input id="amount" inputmode="decimal" placeholder="0.05" /><span class="unit">SOL</span></div>
      <div class="card" style="padding:11px 13px">
        <div class="kv"><span class="k">Pool fee (estimate)</span><span class="v" id="fee">…</span></div>
        <div class="kv"><span class="k">Destination receives (estimate)</span><span class="v" id="net">…</span></div>
      </div>
      <div class="small" style="font-weight:800">Pool pays the destination <span class="muted" style="font-weight:600">(keep ≈0.003 SOL in the alias for fees)</span></div>
      ${timingControl()}
      <div class="error-text"></div>`
      }
    </div>
    <div class="bottom">
      ${gate ? `<button class="btn btn-primary" data-nav="/settings/mainnet">Enable mainnet</button>` : `<button class="btn btn-primary" id="go">Continue</button>`}
    </div>
  `);
  wireNav();
  if (gate) return;
  const getDelay = wireTiming();
  on('#dest-change', 'click', () => {
    app.querySelector('#dest-known')?.remove();
    const field = app.querySelector('#dest') as HTMLInputElement;
    field.hidden = false;
    field.value = '';
    field.focus();
  });
  const config = await fetchFeeConfig();
  const update = () => {
    const lam = solToLamports(val('#amount') || '0');
    const feeEl = app.querySelector('#fee');
    const netEl = app.querySelector('#net');
    if (!feeEl || !netEl) return;
    if (!config) {
      feeEl.textContent = 'unavailable';
      netEl.textContent = 'unavailable';
      return;
    }
    if (!(lam > 0)) {
      feeEl.textContent = '-';
      netEl.textContent = '-';
      return;
    }
    const fee = poolFeeLamports(lam, config);
    const min = config.minimum_sol !== undefined ? solToLamports(config.minimum_sol) : 0;
    if (min && lam < min) {
      feeEl.textContent = `min ${config.minimum_sol} SOL`;
      netEl.textContent = '-';
      return;
    }
    feeEl.textContent = `≈ ${lamportsToSol(fee)} SOL`;
    netEl.textContent = `≈ ${lamportsToSol(Math.max(0, lam - fee))} SOL`;
  };
  on('#amount', 'input', update);
  update();
  on('#go', 'click', async () => {
    const lam = solToLamports(val('#amount'));
    const dest = val('#dest').trim();
    if (!dest) return showError('Enter the destination address');
    if (!(lam > 0)) return showError('Enter an amount first');
    if (!config) return showError('Could not load live Privacy Cash fees. Check your connection and try again.');
    try {
      await bg<OperationRecord>({
        type: 'ops.start',
        kind: 'return',
        aliasId: alias.id,
        amountLamports: lam,
        destination: dest,
        delayMinutes: getDelay(),
      });
      screen(`
        <div class="grow" style="display:flex;align-items:center;justify-content:center">
          <div class="hero">${mascot(84)}<h1>Continue in the Alias window</h1><p>The return steps run in the small window that just opened.</p></div>
        </div>
        <div class="bottom"><button class="btn btn-soft" data-nav="/">Done</button></div>`);
      wireNav();
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

// ---------- history ----------
async function renderHistory(): Promise<void> {
  const ops = await bg<OperationRecord[]>({ type: 'ops.list' });
  const stepLabel: Record<string, string> = {
    created: 'Started',
    'awaiting-wallet': 'Waiting for main wallet',
    'proving-deposit': 'Preparing deposit',
    'awaiting-signature': 'Waiting for signature',
    'deposit-submitted': 'Deposit pending',
    'deposit-confirmed': 'Deposit confirmed',
    'proving-withdraw': 'Preparing withdrawal',
    'withdraw-submitted': 'Withdrawal pending',
    'withdraw-confirmed': 'Withdrawal confirmed',
    done: 'Done',
    failed: 'Failed',
    unknown: 'Status unknown',
  };
  screen(`
    ${topbar('History', '/')}
    <div class="list grow">
      ${
        ops.length === 0
          ? `<p class="muted" style="text-align:center;margin-top:40px">No private operations yet.</p>`
          : ops
              .slice(0, 20)
              .map((op) => {
                const alias = aliasList.find((a) => a.id === op.aliasId);
                const cls = op.step === 'done' ? 'chip-mint' : op.step === 'failed' ? 'chip-coral' : 'chip-amber';
                return `<button class="card list-item" data-op="${op.id}" style="text-align:left">
                  <div class="meta">
                    <div class="one">${op.kind === 'fund' ? 'Fund' : 'Return'} · ${lamportsToSol(op.amountLamports)} SOL</div>
                    <div class="two">${esc(alias?.name ?? 'Alias')} · ${timeAgo(op.createdAt)}</div>
                  </div>
                  <span class="chip ${cls}">${stepLabel[op.step] ?? op.step}</span>
                </button>`;
              })
              .join('')
      }
    </div>
    <div class="bottom">
      <button class="btn btn-ghost" id="manager">Open full history & recovery</button>
    </div>
  `);
  wireNav();
  on('[data-op]', 'click', (_e, el) => {
    window.open(chrome.runtime.getURL(`ops/ops.html#${el.dataset.op}`), '_blank', 'popup,width=420,height=680');
  });
  on('#manager', 'click', () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  });
}

// ---------- settings ----------
async function renderSettings(): Promise<void> {
  const s = settings!;
  screen(`
    ${topbar('Settings', '/')}
    <div class="stack grow" style="overflow-y:auto">
      <div class="seg" id="net">
        <button data-net="devnet" class="${s.network === 'devnet' ? 'active' : ''}">Devnet</button>
        <button data-net="mainnet-beta" class="${s.network === 'mainnet-beta' ? 'active' : ''}">Mainnet</button>
      </div>
      ${s.mainnetEnabled ? '' : `<div class="notice amber">Mainnet is off. Real funds need explicit consent. <a href="#/settings/mainnet">Enable mainnet</a></div>`}
      <div class="card toggle-row">
        <div><div class="label">Per-operation limit</div><div class="sub">Private fund / return</div></div>
        <input id="opLimit" class="field" style="width:84px;padding:7px 10px" value="${s.perOperationSol}" inputmode="decimal" />
      </div>
      <div class="card toggle-row">
        <div><div class="label">Per-transaction limit</div><div class="sub">Dapp spending (mainnet)</div></div>
        <input id="txLimit" class="field" style="width:84px;padding:7px 10px" value="${s.perTransactionSol}" inputmode="decimal" />
      </div>
      <div class="card toggle-row">
        <div><div class="label">Funding page</div><div class="sub">Where your main wallet signs</div></div>
      </div>
      <input id="companion" class="field" value="${esc(s.companionUrl)}" />
      <div class="card toggle-row">
        <div><div class="label">Your own RPC (optional)</div><div class="sub">Tried first, e.g. a free Helius URL. Public servers are the fallback.</div></div>
      </div>
      <input id="rpc" class="field" placeholder="https://…" value="${esc(s.customRpc ?? '')}" />
      <button class="btn btn-soft" data-nav="/settings/sites">Connected sites</button>
      <button class="btn btn-soft" data-nav="/settings/phrase">Show recovery phrase</button>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="save">Save</button>
      <button class="btn btn-ghost" id="lock">Lock Alias</button>
    </div>
  `);
  wireNav();
  on('[data-net]', 'click', async (_e, el) => {
    const net = el.dataset.net as SettingsState['network'];
    if (net === 'mainnet-beta' && !s.mainnetEnabled) {
      location.hash = '/settings/mainnet';
      return;
    }
    try {
      settings = await bg<SettingsState>({ type: 'settings.update', patch: { network: net } });
      void renderSettings();
    } catch (e) {
      showError((e as Error).message);
    }
  });
  on('#save', 'click', async () => {
    try {
      settings = await bg<SettingsState>({
        type: 'settings.update',
        patch: {
          perOperationSol: Number(val('#opLimit')),
          perTransactionSol: Number(val('#txLimit')),
          companionUrl: val('#companion').trim(),
          customRpc: val('#rpc').trim(),
        },
      });
      location.hash = '';
      void route();
    } catch (e) {
      showError((e as Error).message);
    }
  });
  on('#lock', 'click', async () => {
    await bg({ type: 'vault.lock' });
    void route();
  });
}

function renderMainnetConsent(): void {
  screen(`
    ${topbar('Enable mainnet', '/settings')}
    <div class="stack grow">
      <div class="notice coral">Mainnet uses real SOL. A mistake can cost real money.</div>
      <div class="card" style="padding:12px 14px">
        <div class="kv"><span class="k">Every transaction</span><span class="v">asks you first</span></div>
        <div class="kv"><span class="k">Spending limits</span><span class="v">${settings!.perTransactionSol} SOL / tx, ${settings!.perOperationSol} SOL / operation</span></div>
        <div class="kv"><span class="k">Address separation</span><span class="v">is not anonymity</span></div>
      </div>
      <p class="small muted">Timing, amounts and off-chain data can still allow correlation. Keep amounts small.</p>
      <label class="check-row"><input type="checkbox" id="agree" /> I understand this uses real funds and I keep my own limits in mind.</label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-coral" id="enable">Enable mainnet</button>
    </div>
  `);
  wireNav();
  on('#enable', 'click', async () => {
    if (!(app.querySelector('#agree') as HTMLInputElement).checked) return showError('Tick the box to continue');
    try {
      settings = await bg<SettingsState>({
        type: 'settings.update',
        patch: { mainnetEnabled: true, network: 'mainnet-beta' },
      });
      location.hash = '/settings';
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

async function renderSites(): Promise<void> {
  const grants = await bg<{ origin: string; aliasId: string; grantedAt: number }[]>({ type: 'origins.list' });
  screen(`
    ${topbar('Connected sites', '/settings')}
    <div class="list grow">
      ${
        grants.length === 0
          ? `<p class="muted" style="text-align:center;margin-top:40px">No sites connected yet.</p>`
          : grants
              .map((g) => {
                const alias = aliasList.find((a) => a.id === g.aliasId);
                return `<div class="card list-item">
                  <div class="meta"><div class="one">${esc(new URL(g.origin).hostname)}</div><div class="two">${esc(alias?.name ?? 'Alias')}</div></div>
                  <button class="btn-ghost" style="background:none;color:#9c3a22;font-weight:700" data-revoke="${esc(g.origin)}">Remove</button>
                </div>`;
              })
              .join('')
      }
    </div>
  `);
  wireNav();
  on('[data-revoke]', 'click', async (_e, el) => {
    await bg({ type: 'origins.revoke', origin: el.dataset.revoke! });
    void renderSites();
  });
}

function renderRevealPhrase(): void {
  screen(`
    ${topbar('Recovery phrase', '/settings')}
    <div class="stack grow">
      <p class="muted small">Enter your password to show the 12 words. Anyone with them controls every alias.</p>
      <input id="pw" class="field" type="password" placeholder="Password" />
      <div id="out"></div>
      <div class="error-text"></div>
    </div>
    <div class="bottom"><button class="btn btn-primary" id="show">Show phrase</button></div>
  `);
  wireNav();
  on('#show', 'click', async () => {
    try {
      const { mnemonic } = await bg<{ mnemonic: string }>({ type: 'vault.revealMnemonic', password: val('#pw') });
      const out = app.querySelector('#out')!;
      out.innerHTML = `<div class="phrase-grid">${mnemonic
        .split(' ')
        .map((w, i) => `<div class="phrase-word"><i>${i + 1}</i>${esc(w)}</div>`)
        .join('')}</div>`;
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

// ---------- approvals ----------
async function renderApproval(requestId: string): Promise<void> {
  let payload: ApprovalPayload;
  try {
    payload = await bg<ApprovalPayload>({ type: 'approval.get', requestId });
  } catch {
    screen(`<div class="grow" style="display:flex;align-items:center;justify-content:center"><div class="hero">${mascot(72)}<h1>Nothing to approve</h1><p>This request already finished. You can close this window.</p></div></div>`);
    return;
  }
  if (payload.kind === 'connect') return renderConnectApproval(requestId, payload.request);
  if (payload.kind === 'tx') return renderTxApproval(requestId, payload.request);
  return renderMsgApproval(requestId, payload.request);
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

const KIND_NAMES: Record<AliasKind, string> = {
  trading: 'Trading Alias',
  collecting: 'Collecting Alias',
  everyday: 'Everyday Alias',
  fresh: 'Fresh Alias',
};

async function renderConnectApproval(
  requestId: string,
  request: {
    origin: string;
    siteLabel?: string;
    recommendedAliasId?: string;
    recommendedReason?: string;
    recommendedKind?: AliasKind;
  },
): Promise<void> {
  // `null` means: create the recommended alias when the user approves. An
  // unknown site gets its own fresh alias, never another site's.
  let chosen: string | null = request.recommendedAliasId ?? null;
  const newKind: AliasKind = request.recommendedKind ?? 'fresh';
  const newName = newKind === 'fresh' ? `${hostOf(request.origin)} Alias` : KIND_NAMES[newKind];
  const recommended = aliasList.find((a) => a.id === request.recommendedAliasId);
  const title = recommended ? `Use ${recommended.name} here` : `Use a new ${newKind === 'fresh' ? 'fresh alias' : KIND_NAMES[newKind]} here`;

  const renderBody = (showAll: boolean) => {
    const current = aliasList.find((a) => a.id === chosen);
    screen(`
      ${topbar('Connection request')}
      <div class="stack grow">
        <div class="card site-banner">
          ${mascot(40)}
          <div style="min-width:0">
            <div class="origin">${esc(request.siteLabel ?? hostOf(request.origin))}</div>
            <div class="small muted" style="word-break:break-all">${esc(request.origin)}</div>
          </div>
        </div>
        <div class="hero" style="margin:4px 0 0"><h1 style="font-size:19px">${esc(title)}</h1>
          ${request.recommendedReason ? `<p class="small">${esc(request.recommendedReason)}</p>` : ''}
        </div>
        ${
          showAll
            ? `<div class="list" style="max-height:200px">${aliasList
                .map(
                  (a) => `<button class="card list-item${a.id === chosen ? '' : ''}" data-pick="${a.id}" style="text-align:left;${a.id === chosen ? 'border-color:var(--lilac);background:var(--lilac-soft)' : ''}">
                    ${avatar(a.avatarSeed, 28)}
                    <div class="meta"><div class="one">${esc(a.name)}</div><div class="two">${shortAddress(a.address, 5, 5)}</div></div>
                  </button>`,
                )
                .join('')}
                <button class="card list-item" data-newalias style="text-align:left;${chosen === null ? 'border-color:var(--lilac);background:var(--lilac-soft)' : ''}"><div class="meta"><div class="one">＋ ${esc(newName)}</div><div class="two">New, only for this site</div></div></button>
              </div>`
            : current
              ? `<div class="card list-item">${avatar(current.avatarSeed, 30)}<div class="meta"><div class="one">${esc(current.name)}</div><div class="two mono">${shortAddress(current.address, 6, 6)}</div></div></div>`
              : `<div class="card list-item">${mascot(30)}<div class="meta"><div class="one">${esc(newName)}</div><div class="two">New address, created when you approve</div></div></div>`
        }
        <p class="small muted">The site only sees this alias address. Your main wallet stays separate.</p>
        <div class="error-text"></div>
      </div>
      <div class="bottom">
        <button class="btn btn-primary" id="approve">Use this Alias</button>
        ${showAll ? '' : `<button class="btn btn-ghost" id="choose">Choose another</button>`}
        <button class="btn btn-ghost" id="reject">Cancel</button>
      </div>
    `);
    on('#choose', 'click', () => renderBody(true));
    on('[data-pick]', 'click', (_e, el) => {
      chosen = el.dataset.pick!;
      renderBody(true);
    });
    on('[data-newalias]', 'click', () => {
      chosen = null;
      renderBody(false);
    });
    on('#approve', 'click', async () => {
      try {
        if (!chosen) {
          const info = await bg<AliasInfo>({ type: 'alias.create', name: newName, kind: newKind });
          chosen = info.id;
        }
        await bg({ type: 'approval.resolveConnect', requestId, approved: true, aliasId: chosen });
        window.close();
      } catch (e) {
        showError((e as Error).message);
      }
    });
    on('#reject', 'click', async () => {
      await bg({ type: 'approval.resolveConnect', requestId, approved: false });
      window.close();
    });
  };
  renderBody(false);
}

async function renderTxApproval(requestId: string, request: { origin: string; aliasId: string; mode: string; txBase64: string }): Promise<void> {
  const alias = aliasList.find((a) => a.id === request.aliasId)!;
  const isMainnet = settings!.network === 'mainnet-beta';
  screen(`
    ${topbar('Approve transaction')}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias.avatarSeed, 32)}
        <div style="min-width:0"><div class="origin">${esc(hostOf(request.origin))}</div>
        <div class="small muted">asks ${esc(alias.name)} to sign${request.mode === 'signAndSend' ? ' and send' : ''}</div></div>
      </div>
      <div id="sim"><div class="card" style="padding:14px;display:flex;gap:10px;align-items:center"><div class="spin"></div><span class="muted">Checking what this does…</span></div></div>
      <div class="kv"><span class="k">Network</span><span class="v">${isMainnet ? 'Mainnet (real funds)' : 'Devnet'}</span></div>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="approve" disabled>Approve</button>
      <button class="btn btn-ghost" id="reject">Reject</button>
    </div>
  `);
  on('#reject', 'click', async () => {
    await bg({ type: 'approval.resolveTx', requestId, approved: false });
    window.close();
  });

  const sim = await bg<SimulationResult>({ type: 'tx.simulate', txBase64: request.txBase64, aliasAddress: alias.address });
  const slot = app.querySelector('#sim')!;
  const approveBtn = app.querySelector('#approve') as HTMLButtonElement;
  if (!sim.ok) {
    slot.innerHTML = `
      <div class="notice coral">Could not establish what this transaction does.${esc(sim.error ? ` ${sim.error}` : '')}</div>
      ${isMainnet ? `<p class="small muted" style="margin-top:6px">On mainnet, unverified transactions cannot be approved.</p>` : `<p class="small muted" style="margin-top:6px">Devnet only: you can still approve, with care.</p>`}
      ${sim.logsTail?.length ? `<details class="more"><summary>Details</summary><pre>${esc(sim.logsTail.join('\n'))}</pre></details>` : ''}`;
    if (!isMainnet) approveBtn.disabled = false;
  } else {
    slot.innerHTML = `
      <div class="effects">
        ${
          sim.effects.length === 0
            ? `<div class="notice amber">No balance changes for this alias were found in simulation.</div>`
            : sim.effects
                .map((e) => `<div class="effect ${e.uiDelta.startsWith('-') ? 'out' : 'in'}"><span>${e.uiDelta.startsWith('-') ? 'Send' : 'Receive'}</span><span class="mono">${esc(e.uiDelta)}</span></div>`)
                .join('')
        }
      </div>
      <div class="kv" style="margin-top:6px"><span class="k">Network fee (estimate)</span><span class="v mono">${sim.feeLamports !== undefined ? `${lamportsToSol(sim.feeLamports)} SOL` : 'unknown'}</span></div>
      ${sim.writableUnknown ? `<p class="small muted">Some accounts could not be checked; estimates only, not guaranteed settlement.</p>` : `<p class="small muted">Simulation estimate, not guaranteed settlement.</p>`}
      ${sim.logsTail?.length ? `<details class="more"><summary>Details</summary><pre>${esc(sim.logsTail.join('\n'))}</pre></details>` : ''}`;
    approveBtn.disabled = false;
  }
  on('#approve', 'click', async () => {
    approveBtn.disabled = true;
    await bg({ type: 'approval.resolveTx', requestId, approved: true });
    window.close();
  });
}

async function renderMsgApproval(requestId: string, request: { origin: string; aliasId: string; messageBase64: string }): Promise<void> {
  const alias = aliasList.find((a) => a.id === request.aliasId)!;
  let text = '';
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(request.messageBase64), (c) => c.charCodeAt(0)));
  } catch {
    text = '(binary message)';
  }
  screen(`
    ${topbar('Sign a message')}
    <div class="stack grow">
      <div class="card site-banner">${avatar(alias.avatarSeed, 32)}
        <div style="min-width:0"><div class="origin">${esc(hostOf(request.origin))}</div><div class="small muted">asks ${esc(alias.name)} to sign a message</div></div>
      </div>
      <div class="card" style="padding:12px;max-height:200px;overflow:auto;font-size:13px;white-space:pre-wrap;word-break:break-word">${esc(text)}</div>
      <p class="small muted">Signing proves this alias agreed to the text above. It does not move funds.</p>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="approve">Sign</button>
      <button class="btn btn-ghost" id="reject">Reject</button>
    </div>
  `);
  on('#approve', 'click', async () => {
    await bg({ type: 'approval.resolveMsg', requestId, approved: true });
    window.close();
  });
  on('#reject', 'click', async () => {
    await bg({ type: 'approval.resolveMsg', requestId, approved: false });
    window.close();
  });
}

// Keep the service worker alive while an approval window is open.
setInterval(() => {
  if (document.body.classList.contains('windowed')) void bgCall({ type: 'ping' });
}, 20_000);

void route();
