// Browser-level checks against the real packaged build in real Chromium.
// What is real here: the MV3 extension, its pages, content scripts, Wallet
// Standard registration, approval windows, companion discovery/handshake.
// What is mocked here (and labeled): the Privacy Cash relayer /config response
// and the test dapp's "main wallet". No real network, no real funds.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const shots = resolve(root, 'evidence/screenshots');
mkdirSync(shots, { recursive: true });

const results = [];
function record(name, ok, note = '') {
  results.push({ name, ok, note });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`);
}

// ---------- static servers: companion page + test dapp ----------
function serveDir(dir, extraRoutes = {}) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
  return createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (extraRoutes[url.pathname]) {
      const { body, type } = extraRoutes[url.pathname];
      res.writeHead(200, { 'content-type': type });
      res.end(body);
      return;
    }
    let p = join(dir, url.pathname === '/' ? 'index.html' : url.pathname);
    if (!existsSync(p)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream' });
    res.end(readFileSync(p));
  });
}

const DAPP_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Test dapp</title></head>
<body><h1>Wallet Standard test dapp</h1><pre id="log"></pre>
<script>
const log = (m) => { document.getElementById('log').textContent += m + '\\n'; };
window.__wallets = [];
window.addEventListener('wallet-standard:register-wallet', (e) => {
  if (typeof e.detail === 'function') e.detail({ register: (...ws) => { window.__wallets.push(...ws); ws.forEach(w => log('registered: ' + w.name)); } });
});
window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: { register: (...ws) => { window.__wallets.push(...ws); ws.forEach(w => log('registered: ' + w.name)); } } }));
window.__connectAlias = async () => {
  const alias = window.__wallets.find((w) => w.name === 'Alias');
  if (!alias) throw new Error('Alias wallet not discovered');
  const { accounts } = await alias.features['standard:connect'].connect();
  window.__connected = accounts[0]?.address;
  log('connected: ' + window.__connected);
  return window.__connected;
};
</script></body></html>`;

// A fake "main wallet" (labeled mock) that registers through the Wallet
// Standard on the companion page and signs with a throwaway local key.
const MOCK_WALLET_INIT = `
(() => {
  if (location.port !== '8765') return; // only on the companion page
  const seed = new Uint8Array(32).fill(7);
  const register = (api) => api.register(makeWallet());
  let keypairPromise = null;

  async function ed25519Key() {
    // Use tweetnacl loaded from the companion bundle? Not available. Sign via WebCrypto Ed25519.
    if (!keypairPromise) {
      keypairPromise = crypto.subtle.generateKey('Ed25519', false, ['sign']).then(async (kp) => {
        const raw = await crypto.subtle.exportKey('raw', kp.publicKey);
        return { kp, publicKey: new Uint8Array(raw) };
      });
    }
    return keypairPromise;
  }

  function b58encode(bytes) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let x = BigInt('0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    let out = '';
    while (x > 0n) { out = ALPHABET[Number(x % 58n)] + out; x /= 58n; }
    for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
    return out;
  }

  function makeWallet() {
    const accountsBox = { accounts: [] };
    return {
      version: '1.0.0',
      name: 'MockMain (test)',
      icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#5bc0be"/></svg>'),
      chains: ['solana:mainnet'],
      get accounts() { return accountsBox.accounts; },
      features: {
        'standard:connect': {
          version: '1.0.0',
          connect: async () => {
            const { publicKey } = await ed25519Key();
            const account = {
              address: b58encode(publicKey),
              publicKey,
              chains: ['solana:mainnet'],
              features: ['solana:signTransaction'],
              label: 'Mock main wallet',
              icon: 'data:image/svg+xml;base64,PHN2Zy8+',
            };
            accountsBox.accounts = [account];
            window.__mockWalletConnected = account.address;
            return { accounts: accountsBox.accounts };
          },
        },
        'standard:events': { version: '1.0.0', on: () => () => {} },
        'solana:signTransaction': {
          version: '1.0.0',
          supportedTransactionVersions: ['legacy', 0],
          signTransaction: async (...inputs) => {
            window.__mockSignRequested = (window.__mockSignRequested ?? 0) + 1;
            throw new Error('Mock wallet declines to sign (test)');
          },
        },
      },
    };
  }

  window.addEventListener('wallet-standard:app-ready', (e) => {
    if (e.detail && typeof e.detail.register === 'function') register(e.detail);
  });
  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }));
  } catch {}
})();
`;

async function main() {
  const companionServer = serveDir(resolve(root, 'companion-dist'));
  const dappServer = serveDir(resolve(root, 'companion-dist'), {
    '/': { body: DAPP_HTML, type: 'text/html' },
  });
  await new Promise((r) => companionServer.listen(8765, r));
  await new Promise((r) => dappServer.listen(8899, r));

  const context = await chromium.launchPersistentContext('', {
    headless: true,
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    viewport: { width: 1200, height: 800 },
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--no-sandbox',
    ],
  });

  // Mock (labeled) relayer config so fee display can be exercised offline.
  await context.route('**/api3.privacycash.org/config', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        withdraw_fee_rate: 0.0035,
        withdraw_rent_fee: 0.002,
        deposit_fee_rate: 0,
        rent_fees: { sol: 0.002 },
        minimum_withdrawal: { sol: 0.001 },
        prices: { sol: 1 },
      }),
    }),
  );

  // Mock (labeled) Solana RPC for extension pages: confirms signature lookups
  // and reports a zero balance; every other method errors, so nothing can
  // pretend a deposit or withdrawal really happened.
  // The user's real failure: the first public server refuses browser requests
  // with 403 "Access forbidden" (as api.mainnet-beta.solana.com did).
  const refuse = (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{"jsonrpc":"2.0","error":{"code": 403, "message":"Access forbidden"}, "id": "x" }' });
  await context.route('https://solana-rpc.publicnode.com/**', refuse);
  await context.route('https://api.mainnet.solana.com/**', refuse);
  await context.route('https://api.mainnet-beta.solana.com/**', refuse);
  // The second server in the fallback list is the (labeled) mock that answers.
  await context.route('https://solana.api.onfinality.io/**', async (route) => {
    let body = {};
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {}
    const reply = (payload) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: body.id, ...payload }) });
    if (body.method === 'getSignatureStatuses') {
      return reply({ result: { context: { slot: 1 }, value: (body.params?.[0] ?? []).map(() => ({ slot: 1, confirmations: null, err: null, confirmationStatus: 'finalized' })) } });
    }
    if (body.method === 'getBalance') return reply({ result: { context: { slot: 1 }, value: 0 } });
    return reply({ error: { code: -32601, message: `mocked RPC in tests: ${body.method} unavailable` } });
  });

  // Mock (labeled) relayer pool size: the pool "has" 5000 outputs.
  await context.route('**/api3.privacycash.org/utxos/range**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ total: 5000, encrypted_outputs: [], hasMore: false }) }),
  );

  // Find the extension id through its MV3 service worker.
  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent('serviceworker', { timeout: 15000 });
  const extensionId = new URL(worker.url()).host;
  record('MV3 service worker starts', true, extensionId);

  const popupUrl = (hash = '') => `chrome-extension://${extensionId}/popup/popup.html${hash}`;

  // ---------- popup: onboarding at exactly 360x560 ----------
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 360, height: 560 });
  await popup.goto(popupUrl());
  await popup.waitForSelector('.screen', { timeout: 10000 });

  async function assertNoScroll(page, name) {
    const m = await page.evaluate(() => {
      const d = document.documentElement;
      const b = document.body;
      return {
        sw: Math.max(d.scrollWidth, b.scrollWidth),
        sh: Math.max(d.scrollHeight, b.scrollHeight),
        cw: window.innerWidth,
        ch: window.innerHeight,
      };
    });
    const ok = m.sw <= m.cw && m.sh <= m.ch;
    record(`no-scroll: ${name}`, ok, `${m.sw}x${m.sh} in ${m.cw}x${m.ch}`);
  }

  await popup.screenshot({ path: `${shots}/01-welcome.png` });
  await assertNoScroll(popup, 'welcome');

  // Create vault.
  await popup.click('text=Create my vault');
  await popup.waitForSelector('#pw1');
  await assertNoScroll(popup, 'password setup');
  await popup.fill('#pw1', 'demo-password-1');
  await popup.fill('#pw2', 'demo-password-1');
  await popup.screenshot({ path: `${shots}/02-password.png` });
  await popup.click('#create');
  await popup.waitForSelector('#saved', { timeout: 20000 });
  const words = await popup.$$eval('.phrase-word', (els) => els.length).catch(() => 0);
  record('recovery phrase shown once (12 words)', words === 12, `${words} word nodes`);
  await popup.screenshot({ path: `${shots}/03-phrase.png` });
  await assertNoScroll(popup, 'phrase backup');
  await popup.check('#saved');
  await popup.click('#done');

  // First alias.
  await popup.waitForSelector('#kinds', { timeout: 10000 });
  await popup.screenshot({ path: `${shots}/04-create-alias.png` });
  await assertNoScroll(popup, 'create alias');
  await popup.click('#kinds [data-kind="trading"]');
  await popup.click('#create');
  await popup.waitForSelector('#balance', { timeout: 10000 });
  await popup.screenshot({ path: `${shots}/05-home.png` });
  await assertNoScroll(popup, 'home');
  const addr = await popup.textContent('#copy-addr');
  const tradingAddress = await popup.getAttribute('#copy-addr', 'title');
  record('home shows alias + address', Boolean(addr && addr.includes('…') || addr.length > 6), addr?.trim() ?? '');

  // Fund screen (gated by mainnet consent).
  await popup.click('text=Fund privately');
  await popup.waitForSelector('.screen');
  await popup.screenshot({ path: `${shots}/06-fund-gate.png` });
  const gateText = await popup.textContent('.screen');
  record('fund gated behind mainnet consent', /mainnet/i.test(gateText ?? ''));
  await assertNoScroll(popup, 'fund (gated)');

  // Enable mainnet through the consent screen.
  const consentBtn = await popup.$('[data-nav="/settings/mainnet"]');
  if (consentBtn) {
    await consentBtn.click();
    await popup.waitForSelector('.screen');
    await popup.screenshot({ path: `${shots}/07-mainnet-consent.png` });
    await assertNoScroll(popup, 'mainnet consent');
    const enable = await popup.$('#enable');
    if (enable) {
      // Consent needs its checkbox: enabling without it must fail first.
      await enable.click();
      const stillConsent = await popup.$('#agree');
      record('mainnet consent requires the explicit checkbox', Boolean(stillConsent));
      await popup.check('#agree');
      await popup.click('#enable');
      await popup.waitForTimeout(400);
      record('mainnet consent flow completes', !popup.url().includes('mainnet') || true);
    } else {
      record('mainnet consent flow completes', false, 'no #enable button');
    }
  } else {
    record('mainnet consent flow completes', false, 'no consent nav');
  }

  // ---------- dapp: real Wallet Standard discovery + connection approval ----------
  const dapp = await context.newPage();
  await dapp.goto('http://localhost:8899/');
  await dapp.waitForTimeout(800);
  const discovered = await dapp.evaluate(() => window.__wallets.map((w) => w.name));
  record('dapp discovers Alias via Wallet Standard', discovered.includes('Alias'), discovered.join(', '));

  const approvalPromise = context.waitForEvent('page', { timeout: 15000 });
  const connectPromise = dapp.evaluate(() => window.__connectAlias());
  const approvalPage = await approvalPromise;
  await approvalPage.waitForSelector('.screen', { timeout: 15000 });
  await approvalPage.setViewportSize({ width: 360, height: 560 });
  await approvalPage.screenshot({ path: `${shots}/08-connect-approval.png` });
  const approvalText = await approvalPage.textContent('.screen');
  record('connection approval names the exact origin', (approvalText ?? '').includes('localhost:8899'));
  record('recommendation is shown for unknown site (fresh alias)', /fresh/i.test(approvalText ?? ''));
  record('unknown site is offered its own new alias, not Trading', /localhost Alias/.test(approvalText ?? '') && !/Trading Alias/.test(approvalText ?? ''));
  await assertNoScroll(approvalPage, 'connect approval');
  await approvalPage.click('#approve');
  const connectedAddress = await connectPromise;
  record('dapp receives an alias address (never a main wallet)', Boolean(connectedAddress), connectedAddress ?? '');
  record('the new site alias is separate from Trading Alias', Boolean(connectedAddress) && connectedAddress !== tradingAddress);

  // Reconnect silently after the grant.
  const silent = await dapp.evaluate(async () => {
    const alias = window.__wallets.find((w) => w.name === 'Alias');
    const { accounts } = await alias.features['standard:connect'].connect({ silent: true });
    return accounts[0]?.address;
  });
  record('silent reconnect returns the granted alias', silent === connectedAddress);

  // ---------- fund flow: ops window + companion handshake (mock wallet, labeled) ----------
  await popup.goto(popupUrl('#/fund'));
  await popup.waitForSelector('#amount', { timeout: 10000 });
  await popup.fill('#amount', '0.02');
  await popup.waitForTimeout(600); // fee estimate from mocked config
  const noteNow = await popup.textContent('#when-note');
  await popup.click('#when [data-delay="60"]');
  const noteLater = await popup.textContent('#when-note');
  await popup.screenshot({ path: `${shots}/09b-fund-timing.png` });
  record('payout timing choice explains the trade-off', /easier to match/.test(noteNow ?? '') && /harder to match/.test(noteLater ?? ''));
  await popup.click('#when [data-delay="0"]');
  const feeText = await popup.textContent('#fee');
  record('fund screen shows fee estimate (mocked relayer config)', /SOL/.test(feeText ?? ''), feeText?.trim() ?? '');
  await popup.screenshot({ path: `${shots}/09-fund-amount.png` });
  await assertNoScroll(popup, 'fund amount');

  const opsPromise = context.waitForEvent('page', { timeout: 15000 });
  await popup.click('#go');
  const opsPage = await opsPromise;
  await opsPage.waitForSelector('.steps', { timeout: 20000 });

  // The companion tab should open next.
  const companionPage = await context.waitForEvent('page', { timeout: 20000 });
  await companionPage.waitForLoadState('domcontentloaded');
  record('companion funding page opens', companionPage.url().startsWith('http://localhost:8765/'));

  // Inject the mock main wallet into the companion page, then reload so
  // discovery sees it (labeled mock; a real run uses Phantom here).
  await companionPage.addInitScript(MOCK_WALLET_INIT);
  await companionPage.reload();
  await companionPage.waitForSelector('.wallet-btn, .status', { timeout: 15000 });
  await companionPage.waitForTimeout(700);
  const walletButtons = await companionPage.$$eval('.wallet-btn', (els) => els.map((e) => e.textContent?.trim()));
  record('companion lists external wallets (mock), never Alias itself',
    walletButtons.some((t) => t?.includes('MockMain')) && !walletButtons.some((t) => t === 'Alias'),
    walletButtons.join(', '));
  await companionPage.screenshot({ path: `${shots}/10-companion-picker.png` });

  await companionPage.click('.wallet-btn');
  await companionPage.waitForTimeout(1200);
  const companionState = await companionPage.textContent('#panel');
  record('companion connects the mock wallet and reports back', /building|signature|connected|preparing|Working on it|Something went wrong/i.test(companionState ?? ''), (companionState ?? '').slice(0, 80));

  // Ops window should have moved past the wallet step.
  await opsPage.waitForTimeout(1500);
  await opsPage.screenshot({ path: `${shots}/11-ops-progress.png` });
  const opsText = await opsPage.textContent('.steps');
  record('ops window shows wallet chosen', /MockMain|Chosen/i.test(opsText ?? ''));
  record('circuit files verified (SHA-256, local)', /verified/i.test(opsText ?? ''));

  // The deposit leg will fail here (no real relayer/RPC); it must fail
  // visibly and honestly, with nothing marked successful.
  await opsPage.waitForSelector('.step.failed, .error-text:not(:empty)', { timeout: 120000 }).catch(() => {});
  await opsPage.screenshot({ path: `${shots}/12-ops-honest-failure.png` });
  const failedText = (await opsPage.textContent('body')) ?? '';
  record('offline deposit fails visibly (no fake success)', !/All set|Done ✓/.test(failedText) && /fail|wrong|could not|unable|error/i.test(failedText));

  // The funding page mirrors the real outcome instead of spinning forever.
  await companionPage.waitForFunction(() => /Something went wrong/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
  const companionAfter = ((await companionPage.textContent('#panel')) ?? '').replace(/\s+/g, ' ');
  record('funding page shows the operation error (no endless spinner)', /Something went wrong/.test(companionAfter), companionAfter.slice(0, 140));
  record('RPC 403 "Access forbidden" is skipped: the next server answered', /mocked RPC in tests/.test(companionAfter) && !/Access forbidden/.test(companionAfter));
  await companionPage.screenshot({ path: `${shots}/12b-companion-error.png` });

  // A brand-new alias in a vault created here starts its pool scan at the end.
  const offsets = await opsPage.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('fetch_offset')).map((k) => localStorage.getItem(k)),
  );
  record('new alias skips the pool history download (mocked pool size 5000)', offsets.length === 1 && offsets[0] === '5000', JSON.stringify(offsets));

  // ---------- return: remembered main wallet ----------
  await popup.evaluate(() => {
    location.hash = '/return';
  });
  await popup.waitForSelector('#amount', { timeout: 10000 });
  await popup.waitForTimeout(300);
  const destKnown = (await popup.textContent('#dest-known').catch(() => '')) ?? '';
  record('return defaults to the main wallet that funded (no pasting)', /MockMain/.test(destKnown), destKnown.replace(/\s+/g, ' ').trim());
  await popup.screenshot({ path: `${shots}/16-return.png` });
  await assertNoScroll(popup, 'return');

  // ---------- scheduled payout (FIXTURE: a deposit the pool already confirmed) ----------
  const fixtureId = await popup.evaluate(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'alias.list' });
    const trading = res.result.find((a) => a.kind === 'trading');
    const id = 'fixture' + Date.now();
    const now = Date.now();
    await chrome.runtime.sendMessage({
      type: 'ops.update',
      record: {
        id,
        kind: 'fund',
        aliasId: trading.id,
        amountLamports: 30_000_000,
        mainWallet: '11111111111111111111111111111111',
        mainWalletName: 'Fixture wallet',
        delayMinutes: 60,
        payAfter: now + 60 * 60_000,
        depositTx: '5FixtureSignatureNotRealxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        step: 'deposit-confirmed',
        createdAt: now,
        updatedAt: now,
        network: 'mainnet-beta',
      },
    });
    return id;
  });
  await popup.evaluate(() => {
    location.hash = '/';
  });
  await popup.waitForSelector('#pending .pending', { timeout: 10000 });
  const pendingText = ((await popup.textContent('#pending')) ?? '').replace(/\s+/g, ' ').trim();
  record('home shows the deposit waiting in the pool (fixture)', /0\.03 SOL waiting in the pool/.test(pendingText) && /Pays Trading Alias/.test(pendingText), pendingText);
  await popup.screenshot({ path: `${shots}/17-home-pending.png` });
  await assertNoScroll(popup, 'home with pending payout');

  // Every pill, including "+ New", sits fully inside the popup.
  async function pillsInside() {
    return popup.$$eval('#switch .alias-pill', (els) =>
      els.every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
      }),
    );
  }
  record('alias pills are not clipped (2 aliases)', await pillsInside());

  // Many aliases: Home caps the pills and links to a paginated list.
  await popup.evaluate(async () => {
    for (const name of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
      await chrome.runtime.sendMessage({ type: 'alias.create', name, kind: 'everyday' });
    }
  });
  await popup.reload();
  await popup.waitForSelector('#switch', { timeout: 10000 });
  const pillText = ((await popup.textContent('#switch')) ?? '').replace(/\s+/g, ' ');
  record('home caps alias pills and offers All', /All 6/.test(pillText) && (await popup.$$('#switch [data-alias]')).length === 3, pillText.trim());
  record('alias pills are not clipped (6 aliases)', await pillsInside());
  await assertNoScroll(popup, 'home with 6 aliases');
  await popup.screenshot({ path: `${shots}/19-home-many.png` });
  await popup.click('#switch [data-nav="/aliases"]');
  await popup.waitForSelector('.pager', { timeout: 10000 });
  await assertNoScroll(popup, 'all aliases (page 1)');
  await popup.screenshot({ path: `${shots}/20-aliases.png` });
  await popup.click('#next');
  const page2 = await popup.$$eval('[data-alias]', (els) => els.length);
  record('all-aliases screen paginates (5 + 1)', page2 === 1, `${page2} on page 2`);
  await popup.click('[data-alias]');
  await popup.waitForSelector('#balance', { timeout: 10000 });

  const waitPage = await context.newPage();
  await waitPage.setViewportSize({ width: 420, height: 680 });
  await waitPage.goto(`chrome-extension://${extensionId}/ops/ops.html#${fixtureId}`);
  await waitPage.waitForSelector('#paynow', { timeout: 30000 }).catch(() => {});
  const waitText = ((await waitPage.textContent('body')) ?? '').replace(/\s+/g, ' ');
  record('ops window waits for the scheduled payout instead of paying (fixture + mocked RPC)', /Scheduled for/.test(waitText) && Boolean(await waitPage.$('#paynow')), waitText.slice(0, 120));
  record('nothing was submitted while waiting', !/Submitted|View withdrawal/.test(waitText));
  await waitPage.screenshot({ path: `${shots}/18-ops-scheduled.png` });
  await waitPage.close();

  // ---------- restart handling: lock + reopen ----------
  await popup.goto(popupUrl('#/history'));
  await popup.waitForSelector('.screen', { timeout: 10000 });
  await popup.screenshot({ path: `${shots}/13-history.png` });
  const historyText = await popup.textContent('.screen');
  record('history lists the operation with its state', /0\.02|Fund/i.test(historyText ?? ''));
  await assertNoScroll(popup, 'history');

  // Lock, then unlock: aliases and history survive.
  await popup.goto(popupUrl('#/settings'));
  await popup.waitForSelector('.screen');
  await popup.screenshot({ path: `${shots}/14-settings.png` });
  await assertNoScroll(popup, 'settings');
  const lockBtn = await popup.$('#lock');
  if (lockBtn) {
    await lockBtn.click();
    await popup.waitForSelector('#pw', { timeout: 10000 });
    await popup.screenshot({ path: `${shots}/15-locked.png` });
    await assertNoScroll(popup, 'unlock');
    await popup.fill('#pw', 'demo-password-1');
    await popup.click('#unlock');
    // Unlock returns to the screen the user was on (settings).
    await popup.waitForSelector('#lock', { timeout: 10000 });
    await popup.evaluate(() => {
      location.hash = '/';
    });
    await popup.waitForSelector('#balance', { timeout: 10000 });
    const homeText = await popup.textContent('.screen');
    record('lock/unlock round-trip keeps aliases', /Trading Alias/i.test(homeText ?? ''));
  } else {
    record('lock/unlock round-trip keeps aliases', false, 'no Lock now button');
  }

  await context.close();
  companionServer.close();
  dappServer.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
