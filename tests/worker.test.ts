// The Alias server (Cloudflare Worker): funding page + restricted RPC relay.
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let worker: { fetch: (req: Request, env: Record<string, string>) => Promise<Response> };
const ENV = { HELIUS_API_KEY: 'test-key-123' };
const EXT = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

beforeAll(async () => {
  execSync('node build.mjs', { cwd: process.cwd(), stdio: 'ignore' });
  const path = '../hosting-dist/alias-worker.js';
  worker = (await import(/* @vite-ignore */ path)).default;
}, 120_000);

beforeEach(() => vi.unstubAllGlobals());

const rpc = (body: unknown, headers: Record<string, string> = { origin: EXT }) =>
  new Request('https://alias.example.workers.dev/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

function mockUpstream(result: unknown = 'ok') {
  const calls: { url: string; body: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), { status: 200 });
    }),
  );
  return calls;
}

describe('funding page', () => {
  it('serves the page, its script, styles and fonts', async () => {
    const page = await worker.fetch(new Request('https://x/'), ENV);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toContain('companion.js');
    const js = await worker.fetch(new Request('https://x/companion.js'), ENV);
    expect(await js.text()).toBe(readFileSync('companion-dist/companion.js', 'utf8'));
    const font = await worker.fetch(new Request('https://x/fonts/archivo-400.woff2'), ENV);
    expect(Buffer.from(await font.arrayBuffer()).equals(readFileSync('companion-dist/fonts/archivo-400.woff2'))).toBe(true);
    expect((await worker.fetch(new Request('https://x/nope'), ENV)).status).toBe(404);
  });
});

describe('RPC relay', () => {
  it('forwards allowed requests to Helius with the secret key', async () => {
    const calls = mockUpstream(42);
    const res = await worker.fetch(rpc({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: ['x'] }), ENV);
    expect(res.status).toBe(200);
    expect((await res.json()).result).toBe(42);
    expect(calls[0].url).toBe('https://mainnet.helius-rpc.com/?api-key=test-key-123');
    expect(res.headers.get('access-control-allow-origin')).toBe(EXT);
  });

  it('never sends the key back and refuses methods Alias does not use', async () => {
    const calls = mockUpstream();
    const res = await worker.fetch(rpc({ jsonrpc: '2.0', id: 7, method: 'getProgramAccounts', params: [] }), ENV);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain('test-key-123');
    expect(calls).toHaveLength(0);
    // A batch is refused if any item is not allowed.
    const batch = await worker.fetch(rpc([{ method: 'getBalance' }, { method: 'requestAirdrop' }]), ENV);
    expect(batch.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('refuses websites but serves the extension', async () => {
    const calls = mockUpstream();
    const site = await worker.fetch(rpc({ method: 'getBalance' }, { origin: 'https://evil.example' }), ENV);
    expect(site.status).toBe(403);
    expect(calls).toHaveLength(0);
    const pre = await worker.fetch(new Request('https://x/rpc', { method: 'OPTIONS', headers: { origin: EXT } }), ENV);
    expect(pre.status).toBe(204);
  });

  it('rejects malformed, oversized and non-POST requests', async () => {
    mockUpstream();
    const bad = new Request('https://x/rpc', { method: 'POST', headers: { origin: EXT }, body: '{not json' });
    expect((await worker.fetch(bad, ENV)).status).toBe(400);
    const huge = new Request('https://x/rpc', { method: 'POST', headers: { origin: EXT }, body: 'x'.repeat(300_000) });
    expect((await worker.fetch(huge, ENV)).status).toBe(413);
    expect((await worker.fetch(new Request('https://x/rpc', { method: 'GET' }), ENV)).status).toBe(405);
  });

  it('says clearly when the key is missing, and supports another provider via RPC_URL', async () => {
    const missing = await worker.fetch(rpc({ method: 'getBalance' }), {});
    expect(missing.status).toBe(503);
    expect(await missing.text()).toContain('HELIUS_API_KEY');
    const calls = mockUpstream();
    await worker.fetch(rpc({ method: 'getBalance' }), { RPC_URL: 'https://other.rpc/key' });
    expect(calls[0].url).toBe('https://other.rpc/key');
  });

  it('health check reports whether the key works', async () => {
    mockUpstream('ok');
    const ok = await (await worker.fetch(new Request('https://x/health'), ENV)).json();
    expect(ok).toMatchObject({ ok: true, rpc: 'ok', fundingPage: true });
    const none = await (await worker.fetch(new Request('https://x/health'), {})).json();
    expect(none.ok).toBe(false);
    expect(none.rpc).toContain('HELIUS_API_KEY');
  });
});
