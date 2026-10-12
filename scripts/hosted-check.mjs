// End-to-end check of the hosted setup in real Chromium: the extension is built
// with an Alias server address, the real Worker code answers that address
// (Helius upstream is mocked), and public RPC servers refuse everything.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SERVER = 'https://alias.example.workers.dev';
const cfgPath = new URL('../alias.config.json', import.meta.url).pathname;
const original = readFileSync(cfgPath, 'utf8');
const results = [];
const record = (name, ok, note = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`); };

writeFileSync(cfgPath, JSON.stringify({ server: SERVER }, null, 2));
try {
  execSync('node build.mjs', { stdio: 'ignore' });
  const worker = (await import(`../hosting-dist/alias-worker.js?${Date.now()}`)).default;
  const env = { HELIUS_API_KEY: 'test-key' };
  let upstreamCalls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith('https://mainnet.helius-rpc.com/')) {
      upstreamCalls++;
      const body = JSON.parse(init.body);
      const result = body.method === 'getBalance' ? { context: { slot: 1 }, value: 12_300_000 } : null;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), { status: 200 });
    }
    return realFetch(url, init);
  };

  const dist = new URL('../dist', import.meta.url).pathname;
  const ctx = await chromium.launchPersistentContext('', {
    headless: true, executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--no-sandbox'],
  });
  // The real Worker code serves the Alias server address.
  await ctx.route(`${SERVER}/**`, async (route) => {
    const r = route.request();
    const req = new Request(r.url(), { method: r.method(), headers: r.headers(), body: ['GET', 'HEAD'].includes(r.method()) ? undefined : r.postDataBuffer() });
    const res = await worker.fetch(req, env);
    route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  // Every public RPC refuses, like the user's 403.
  for (const h of ['solana-rpc.publicnode.com', 'solana.api.onfinality.io', 'api.mainnet.solana.com', 'api.mainnet-beta.solana.com']) {
    await ctx.route(`https://${h}/**`, (r) => r.fulfill({ status: 403, body: '{"error":{"code":403,"message":"Access forbidden"}}' }));
  }
  await ctx.route('**/api3.privacycash.org/config', (r) => r.fulfill({ contentType: 'application/json', body: '{"withdraw_fee_rate":0.0035,"withdraw_rent_fee":0.006}' }));

  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const id = new URL(sw.url()).host;
  const p = await ctx.newPage(); await p.setViewportSize({ width: 360, height: 560 });
  await p.goto(`chrome-extension://${id}/popup/popup.html`);
  await p.click('text=Create my vault'); await p.fill('#pw1', 'demo-password-1'); await p.fill('#pw2', 'demo-password-1');
  await p.click('#create'); await p.waitForSelector('#saved', { timeout: 20000 }); await p.check('#saved'); await p.click('#done');
  await p.waitForSelector('#kinds'); await p.click('#kinds [data-kind="trading"]'); await p.click('#create');
  await p.waitForSelector('#balance', { timeout: 15000 });
  await p.evaluate(() => { location.hash = '/settings/mainnet'; }); await p.waitForSelector('#agree'); await p.check('#agree'); await p.click('#enable');
  await p.waitForTimeout(400);
  await p.evaluate(() => { location.hash = '/'; }); await p.waitForSelector('#balance');
  await p.waitForFunction(() => /SOL|unavailable/.test(document.querySelector('#balance')?.textContent ?? ''), null, { timeout: 15000 });
  const bal = (await p.textContent('#balance')).trim();
  record('balance arrives through the Alias relay with every public RPC refusing (no API key on the user side)', bal === '0.0123 SOL' && upstreamCalls > 0, `${bal}, ${upstreamCalls} relayed`);

  await p.evaluate(() => { location.hash = '/settings'; }); await p.waitForSelector('#companion', { state: 'attached' });
  const fundingUrl = await p.inputValue('#companion');
  record('funding page defaults to the hosted server (no terminal)', fundingUrl === SERVER, fundingUrl);

  await p.evaluate(() => { location.hash = '/fund'; }); await p.waitForSelector('#amount');
  await p.fill('#amount', '0.02'); await p.waitForTimeout(400);
  const opsP = ctx.waitForEvent('page'); await p.click('#go'); await opsP;
  const companion = await ctx.waitForEvent('page', { timeout: 20000 });
  await companion.waitForLoadState('domcontentloaded');
  await companion.waitForSelector('.wallet-btn, .status', { timeout: 15000 });
  const text = ((await companion.textContent('#panel')) ?? '').replace(/\s+/g, ' ');
  record('Fund privately opens the hosted funding page and the extension bridge answers', companion.url().startsWith(`${SERVER}/#op=`) && /Fund privately/.test(text), companion.url());
  await companion.screenshot({ path: 'evidence/screenshots/21-hosted-funding-page.png' });
  await ctx.close();
  globalThis.fetch = realFetch;
} finally {
  writeFileSync(cfgPath, original);
  execSync('node build.mjs', { stdio: 'ignore' });
}
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} hosted checks passed`);
process.exit(failed ? 1 : 0);
