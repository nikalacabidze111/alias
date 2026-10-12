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
import { aliasTile, markSvg, siteTile, smallMarkSvg } from '../shared/brand';
import { EMOJI_CHOICES, emojiFor, isSingleEmoji, KIND_EMOJI } from '../shared/emoji';

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

function mark(size = 48): string {
  return markSvg(size);
}

function avatar(alias: { name: string; avatarSeed: number; kind?: AliasKind; emoji?: string }, size = 32, onLilac = false): string {
  return aliasTile(alias, size, onLilac);
}

const COPY_ICON = `<svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="9" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M11 3.5V3a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 3v6.5A1.5 1.5 0 0 0 3 11h.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

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
  if (hash === '/alias/edit') return renderEditAlias();
  if (hash.startsWith('/phrase-backup')) return renderPhraseBackup();
  if (aliasList.length === 0) return renderCreateAlias(true);
  return renderHome();
}

window.addEventListener('hashchange', () => void route());

// ---------- onboarding ----------
function renderWelcome(): void {
  screen(`
    <div class="intro grow">
      ${mark(52)}
      <h1 class="display">One wallet per app.<br />No link back to you.</h1>
      <p class="lede">Alias gives every site its own address and funds it through Privacy Cash, so your main wallet stays separate.</p>
      <ul class="facts">
        <li><b>Separate aliases</b><span>For trading, NFTs, or one per site</span></li>
        <li><b>Private funding</b><span>No transaction links your wallets</span></li>
        <li><b>One recovery phrase</b><span>12 words restore every alias</span></li>
      </ul>
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
    <div class="intro grow">
      ${mark(52)}
      <h1 class="display">Welcome back</h1>
      <p class="lede">Unlock to use your aliases. Your password never leaves this computer.</p>
      <div class="stack" style="margin-top:6px">
        <input id="pw" class="field" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password" />
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
const ICONS = {
  home: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 9.2 10 3.5l7 5.7V16a1 1 0 0 1-1 1h-3.6v-4.6H7.6V17H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  activity: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 6.2V10l2.6 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  settings: `<svg width="19" height="19" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  chevron: `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  in: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v10M3.8 8.6 8 12.8l4.2-4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  out: `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5v-10M3.8 7.4 8 3.2l4.2 4.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function navBar(active: 'home' | 'activity' | 'settings'): string {
  const item = (key: 'home' | 'activity' | 'settings', label: string, route: string) =>
    `<button class="${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : `data-nav="${route}"`}>${ICONS[key]}<span>${label}</span></button>`;
  return `<nav class="nav" aria-label="Main">${item('home', 'Home', '/')}${item('activity', 'Activity', '/history')}${item('settings', 'Settings', '/settings')}</nav>`;
}

function opStatus(op: OperationRecord): { label: string; cls: string } {
  if (op.step === 'done') return { label: 'Done', cls: 'chip-mint' };
  if (op.step === 'failed') return { label: 'Failed', cls: 'chip-coral' };
  if (op.step === 'deposit-confirmed' && op.payAfter && op.payAfter > Date.now()) return { label: 'Scheduled', cls: 'chip-lilac' };
  if (op.step === 'unknown') return { label: 'Check status', cls: 'chip-lilac' };
  return { label: 'In progress', cls: 'chip-lilac' };
}

function activityRow(op: OperationRecord, aliasName?: string): string {
  const st = opStatus(op);
  const fund = op.kind === 'fund';
  return `<button class="act-row" data-op="${op.id}">
    <span class="act-icon ${fund ? 'in' : 'out'}">${fund ? ICONS.in : ICONS.out}</span>
    <span class="act-meta"><span class="one">${fund ? 'Funded privately' : 'Returned privately'}</span><span class="two num">${aliasName ? `${esc(aliasName)} · ` : ''}${lamportsToSol(op.amountLamports)} SOL · ${timeAgo(op.createdAt)}</span></span>
    <span class="chip ${st.cls}">${st.label}</span>
  </button>`;
}

async function renderHome(): Promise<void> {
  const alias = currentAlias();
  if (!alias) return renderCreateAlias(true);
  selectedAliasId = alias.id;
  localStorage.setItem('alias.selected', alias.id);

  const net = settings!.network;
  const netChip =
    net === 'mainnet-beta'
      ? `<span class="chip chip-coral" title="Real funds">Mainnet</span>`
      : `<span class="chip chip-lilac">Devnet</span>`;

  screen(`
    <div class="topbar">
      <span class="brandline">${smallMarkSvg(22)}<span>Alias</span></span>
      ${netChip}
    </div>
    <div class="home">
      <div class="alias-card">
        <div class="card-head">
          <button class="avatar-btn" id="edit-alias" title="Change emoji and name" aria-label="Change emoji and name">${avatar(alias, 40, true)}</button>
          <div class="head-text">
            <button class="switcher" data-nav="/aliases" aria-label="Switch alias"><span class="alias-name">${esc(alias.name)}</span>${ICONS.chevron}</button>
            <div id="site-chip" class="site-line"></div>
          </div>
        </div>
        <div class="alias-balance num" id="balance">…</div>
        <div class="alias-foot">
          <button class="addr num" id="copy-addr" title="${esc(alias.address)}" aria-label="Copy alias address"><span id="addr-text">${shortAddress(alias.address, 5, 5)}</span>${COPY_ICON}</button>
          <span class="alias-note" id="fund-status">&nbsp;</span>
        </div>
      </div>
      <div class="actions">
        <button class="btn btn-primary" data-nav="/fund">Fund privately</button>
        <button class="btn btn-outline" data-nav="/return">Return privately</button>
      </div>
      <div id="pending"></div>
      <section class="home-activity" aria-label="Activity">
        <div class="section-head"><span>Activity</span><button class="link-quiet" data-nav="/history">See all</button></div>
        <div id="activity"></div>
      </section>
    </div>
    ${navBar('home')}
  `);
  wireNav();
  on('#edit-alias', 'click', () => {
    location.hash = '/alias/edit';
  });
  on('#copy-addr', 'click', async () => {
    await navigator.clipboard.writeText(alias.address);
    const t = app.querySelector('#addr-text');
    if (!t) return;
    t.textContent = 'Copied';
    setTimeout(() => (t.textContent = shortAddress(alias.address, 5, 5)), 900);
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

  // Operations: pending payout card, funding status line, and activity list.
  bg<OperationRecord[]>({ type: 'ops.list' })
    .then((ops) => {
      const now = Date.now();
      const waiting = ops.filter((o) => o.step === 'deposit-confirmed' && !o.withdrawTx);
      const ready = waiting.filter((o) => !o.payAfter || o.payAfter <= now);
      if (ready.length === 0) void chrome.action?.setBadgeText({ text: '' }).catch(() => undefined);
      const op = ready[0] ?? waiting[0];
      const slot = app.querySelector('#pending');
      if (op && slot) {
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
            // The card stays; Activity can reopen it too.
          }
        });
      }

      const mine = ops.filter((o) => o.aliasId === alias.id);
      const status = app.querySelector('#fund-status');
      if (status) {
        const funded = mine.some((o) => o.kind === 'fund' && o.step === 'done');
        const funding = mine.some((o) => o.kind === 'fund' && !['done', 'failed'].includes(o.step));
        status.textContent = funded
          ? 'Funded privately · no direct link to your main wallet'
          : funding
            ? 'Private funding in progress'
            : 'Not funded yet';
      }

      const list = app.querySelector('#activity');
      if (!list) return;
      if (mine.length === 0) {
        list.innerHTML = `<ol class="getting-started">
          <li><b>Fund this alias</b><span>from your main wallet, privately</span></li>
          <li><b>Connect it</b><span>on a site like Jupiter</span></li>
          <li><b>Return funds</b><span>the same private way</span></li>
        </ol>`;
        return;
      }
      const max = op ? 2 : 3;
      list.innerHTML = mine.slice(0, max).map((o) => activityRow(o)).join('');
      on('[data-op]', 'click', async (_e, el) => {
        await bg({ type: 'ops.open', id: el.dataset.op!, payNow: false }).catch(() => undefined);
        window.close();
      });
    })
    .catch(() => undefined);

  // Connected-site line for the active tab.
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.url?.startsWith('http')) {
      const origin = new URL(tab.url).origin;
      const grants = await bg<{ origin: string; aliasId: string }[]>({ type: 'origins.list' });
      const grant = grants.find((g) => g.origin === origin);
      const slot = app.querySelector('#site-chip');
      if (slot && grant) {
        const who = aliasList.find((a) => a.id === grant.aliasId);
        slot.innerHTML = `<span class="conn-dot" aria-hidden="true"></span>Connected to ${esc(new URL(origin).hostname)}${
          who && who.id !== alias.id ? ` as ${esc(who.name)}` : ''
        }`;
      }
    }
  } catch {
    // No tab access; skip the line.
  }
}

// ---------- edit alias: emoji + name ----------
function renderEditAlias(): void {
  const alias = currentAlias();
  if (!alias) return void (location.hash = '/');
  let chosen = emojiFor(alias) ?? '';
  screen(`
    ${topbar('Edit alias', '/')}
    <div class="stack grow">
      <div class="edit-head">
        <span id="preview">${avatar(alias, 56)}</span>
        <input id="name" class="field" value="${esc(alias.name)}" maxlength="40" aria-label="Alias name" />
      </div>
      <div class="field-label" style="margin-top:4px">Pick an emoji</div>
      <div class="emoji-grid" role="group" aria-label="Emoji">
        ${EMOJI_CHOICES.map((e) => `<button class="emoji-opt${e === chosen ? ' active' : ''}" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}
      </div>
      <label class="field-label">Or type any emoji<input id="custom" class="field" placeholder="For example 🐢" maxlength="16" /></label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="save">Save</button>
    </div>
  `);
  wireNav();
  const paint = () => {
    const preview = app.querySelector('#preview');
    if (preview) preview.innerHTML = avatar({ ...alias, emoji: chosen || alias.emoji }, 56);
    app.querySelectorAll<HTMLElement>('.emoji-opt').forEach((b) => b.classList.toggle('active', b.dataset.emoji === chosen));
  };
  on('.emoji-opt', 'click', (_e, el) => {
    chosen = el.dataset.emoji!;
    (app.querySelector('#custom') as HTMLInputElement).value = '';
    showError('');
    paint();
  });
  on('#custom', 'input', (_e, el) => {
    const v = (el as HTMLInputElement).value.trim();
    if (!v) return;
    if (isSingleEmoji(v)) {
      chosen = v;
      showError('');
      paint();
    } else {
      showError('Type a single emoji');
    }
  });
  on('#save', 'click', async () => {
    try {
      const updated = await bg<AliasInfo>({ type: 'alias.update', id: alias.id, name: val('#name'), emoji: chosen || undefined });
      const i = aliasList.findIndex((a) => a.id === updated.id);
      if (i >= 0) aliasList[i] = updated;
      location.hash = '/';
    } catch (e) {
      showError((e as Error).message);
    }
  });
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
            ${avatar(a, 30)}
            <div class="meta"><div class="one">${esc(a.name)}</div><div class="two num" title="${esc(a.address)}">${shortAddress(a.address, 5, 5)}</div></div>
          </button>`,
        )
        .join('')}
      ${
        pages > 1
          ? `<div class="pager"><button class="icon-btn" id="prev" aria-label="Previous page" ${page === 0 ? 'disabled' : ''}>‹</button><span class="num">${page + 1} / ${pages}</span><button class="icon-btn" id="next" aria-label="Next page" ${page === pages - 1 ? 'disabled' : ''}>›</button></div>`
          : ''
      }
    </div>
    <div class="bottom">
      <button class="btn btn-outline" data-nav="/create-alias">New alias</button>
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
        <button class="kind-option active" data-kind="trading"><span class="tile tile-emoji k-tile">${KIND_EMOJI.trading}</span><strong>Trading</strong><span>DEXes and swaps</span></button>
        <button class="kind-option" data-kind="collecting"><span class="tile tile-emoji k-tile">${KIND_EMOJI.collecting}</span><strong>Collecting</strong><span>NFT apps</span></button>
        <button class="kind-option" data-kind="everyday"><span class="tile tile-emoji k-tile">${KIND_EMOJI.everyday}</span><strong>Everyday</strong><span>General use</span></button>
        <button class="kind-option" data-kind="fresh"><span class="tile tile-emoji k-tile">${KIND_EMOJI.fresh}</span><strong>Fresh</strong><span>One site only</span></button>
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
      <div class="card site-banner">${avatar(alias)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">receives through Privacy Cash</div></div></div>
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
        <div class="intro grow">${mark(52)}<h1 class="display">Continue in the Alias window</h1><p class="lede">The funding steps run in the small window that just opened.</p></div>
        <div class="bottom"><button class="btn btn-primary" data-nav="/">Done</button></div>`);
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
      <div class="card site-banner">${avatar(alias)}<div><div style="font-weight:800">${esc(alias.name)}</div><div class="small muted">has ${lamportsToSol(balance)} SOL</div></div></div>
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
        <div class="intro grow">${mark(52)}<h1 class="display">Continue in the Alias window</h1><p class="lede">The return steps run in the small window that just opened.</p></div>
        <div class="bottom"><button class="btn btn-primary" data-nav="/">Done</button></div>`);
      wireNav();
    } catch (e) {
      showError((e as Error).message);
    }
  });
}

// ---------- history ----------
async function renderHistory(): Promise<void> {
  const ops = await bg<OperationRecord[]>({ type: 'ops.list' });
  screen(`
    ${topbar('Activity', '/')}
    <div class="grow history">
      ${
        ops.length === 0
          ? `<p class="muted small" style="margin-top:8px">No activity yet. Fund an alias privately and it shows up here.</p>`
          : `<div id="activity">${ops
              .slice(0, 30)
              .map((op) => activityRow(op, aliasList.find((a) => a.id === op.aliasId)?.name ?? 'Alias'))
              .join('')}</div>`
      }
    </div>
    <div class="bottom">
      <button class="btn btn-outline" id="manager">Full history and recovery</button>
    </div>
  `);
  wireNav();
  on('[data-op]', 'click', async (_e, el) => {
    await bg({ type: 'ops.open', id: el.dataset.op!, payNow: false }).catch(() => undefined);
  });
  on('#manager', 'click', () => {
    void chrome.tabs.create({ url: chrome.runtime.getURL('manager/manager.html') });
  });
}

// ---------- settings ----------
async function renderSettings(): Promise<void> {
  const s = settings!;
  const advancedOpen = Boolean(s.customRpc);
  screen(`
    ${topbar('Settings', '/')}
    <div class="stack grow settings">
      <div class="seg" id="net" role="group" aria-label="Network">
        <button data-net="devnet" class="${s.network === 'devnet' ? 'active' : ''}">Devnet</button>
        <button data-net="mainnet-beta" class="${s.network === 'mainnet-beta' ? 'active' : ''}">Mainnet</button>
      </div>
      ${s.mainnetEnabled ? '' : `<p class="small muted">Mainnet is off until you agree to use real funds. <a href="#/settings/mainnet">Enable mainnet</a></p>`}
      <div class="card group">
        <label class="row-field"><span class="rf-text"><b>Per-transaction limit</b><small>Spending on sites (mainnet)</small></span><span class="unit-input"><input id="txLimit" value="${s.perTransactionSol}" inputmode="decimal" aria-label="Per-transaction limit in SOL" /><em>SOL</em></span></label>
        <label class="row-field"><span class="rf-text"><b>Per-transfer limit</b><small>Fund and return privately</small></span><span class="unit-input"><input id="opLimit" value="${s.perOperationSol}" inputmode="decimal" aria-label="Per-transfer limit in SOL" /><em>SOL</em></span></label>
      </div>
      <div class="card group">
        <button class="row-link" data-nav="/settings/sites"><span>Connected sites</span><span class="chev" aria-hidden="true">›</span></button>
        <button class="row-link" data-nav="/settings/phrase"><span>Recovery phrase</span><span class="chev" aria-hidden="true">›</span></button>
        <button class="row-link" id="lock"><span>Lock Alias</span><span class="chev" aria-hidden="true">›</span></button>
      </div>
      <details class="card group adv"${advancedOpen ? ' open' : ''}>
        <summary class="row-link"><span>Advanced</span><span class="chev" aria-hidden="true">›</span></summary>
        <div class="adv-body">
          <label class="field-label">Funding page<input id="companion" class="field" value="${esc(s.companionUrl)}" /></label>
          <label class="field-label">Your own RPC (optional, tried first)<input id="rpc" class="field" placeholder="https://…" value="${esc(s.customRpc ?? '')}" /></label>
        </div>
      </details>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="save">Save</button>
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
      <div class="card rows">
        <div class="row-item"><div class="k">Every transaction</div><div class="v">Asks you first</div></div>
        <div class="row-item"><div class="k">Spending limits</div><div class="v num">${settings!.perTransactionSol} SOL per transaction · ${settings!.perOperationSol} SOL per private transfer</div></div>
        <div class="row-item"><div class="k">Privacy</div><div class="v">Separate addresses, not anonymity. Timing, amounts and off-chain data can still link activity.</div></div>
      </div>
      <label class="check-row"><input type="checkbox" id="agree" /> I understand this uses real funds and I keep my own limits in mind.</label>
      <div class="error-text"></div>
    </div>
    <div class="bottom">
      <button class="btn btn-primary" id="enable">Enable mainnet</button>
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
    screen(`<div class="intro grow">${mark(52)}<h1 class="display">Nothing to approve</h1><p class="lede">This request already finished. You can close this window.</p></div>`);
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
          ${siteTile(hostOf(request.origin), 40)}
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
                    ${avatar(a, 28)}
                    <div class="meta"><div class="one">${esc(a.name)}</div><div class="two">${shortAddress(a.address, 5, 5)}</div></div>
                  </button>`,
                )
                .join('')}
                <button class="card list-item" data-newalias style="text-align:left;${chosen === null ? 'border-color:var(--lilac);background:var(--lilac-soft)' : ''}"><div class="meta"><div class="one">＋ ${esc(newName)}</div><div class="two">New, only for this site</div></div></button>
              </div>`
            : current
              ? `<div class="card list-item">${avatar(current, 30)}<div class="meta"><div class="one">${esc(current.name)}</div><div class="two mono">${shortAddress(current.address, 6, 6)}</div></div></div>`
              : `<div class="card list-item">${avatar({ name: newName, avatarSeed: 2, kind: newKind }, 30)}<div class="meta"><div class="one">${esc(newName)}</div><div class="two">New address, created when you approve</div></div></div>`
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
      <div class="card site-banner">${avatar(alias, 32)}
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
      <div class="card site-banner">${avatar(alias, 32)}
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
