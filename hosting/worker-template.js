// Alias server (Cloudflare Worker).
//
// One small free server that does two things, so Alias users need no
// terminal and no API key:
//   1. Serves the Alias funding page at "/", where Phantom (or any Solana
//      wallet) signs the private deposit. Wallets only work on real websites,
//      not inside extension pages, so this page has to live on the web.
//   2. Relays Solana RPC requests at "/rpc" to Helius, keeping the API key on
//      the server (secret HELIUS_API_KEY). Only the request types Alias uses
//      are relayed, only for the Alias extension, and nothing is logged.
//
// Set up in the Cloudflare dashboard: create a Worker, paste this whole file,
// Deploy, then add the secret HELIUS_API_KEY under Settings > Variables and
// Secrets. Open /health to check it.

const VERSION = '__VERSION__';

// Exactly the Solana RPC methods Alias and the Privacy Cash SDK call.
const ALLOWED_METHODS = new Set([
  'getAccountInfo',
  'getMultipleAccounts',
  'getBalance',
  'getLatestBlockhash',
  'isBlockhashValid',
  'getSignatureStatuses',
  'getBlockHeight',
  'getSlot',
  'simulateTransaction',
  'sendTransaction',
  'getFeeForMessage',
  'getRecentPrioritizationFees',
  'getMinimumBalanceForRentExemption',
  'getTokenSupply',
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getHealth',
  'getVersion',
]);
const MAX_BODY_BYTES = 200_000;
const MAX_BATCH = 20;

// Funding page files, embedded at build time.
const ASSETS = __ASSETS__;

function upstreamUrl(env) {
  if (env.RPC_URL) return env.RPC_URL; // any provider, full URL including its key
  if (env.HELIUS_API_KEY) return `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(env.HELIUS_API_KEY)}`;
  return null;
}

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin && origin.startsWith('chrome-extension://') ? origin : 'null',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, solana-client',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function json(body, status, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleRpc(request, env) {
  const origin = request.headers.get('origin') || '';
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return json(rpcError(null, -32600, 'Use POST'), 405, cors);
  // Websites cannot use this relay; only the Alias extension (or non-browser callers, which
  // are still limited to Alias's request types below).
  if (origin && !origin.startsWith('chrome-extension://')) {
    return json(rpcError(null, -32600, 'This relay only serves the Alias extension'), 403, cors);
  }
  const target = upstreamUrl(env);
  if (!target) return json(rpcError(null, -32603, 'Relay not configured: add the HELIUS_API_KEY secret'), 503, cors);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json(rpcError(null, -32600, 'Request too large'), 413, cors);
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400, cors);
  }
  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0 || items.length > MAX_BATCH) return json(rpcError(null, -32600, 'Bad batch size'), 400, cors);
  for (const item of items) {
    if (!item || typeof item.method !== 'string' || !ALLOWED_METHODS.has(item.method)) {
      return json(rpcError(item?.id, -32601, `Not available through the Alias relay: ${String(item?.method)}`), 403, cors);
    }
  }

  const upstream = await fetch(target, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text });
  return new Response(upstream.body, {
    status: upstream.status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors },
  });
}

async function handleHealth(env) {
  const target = upstreamUrl(env);
  if (!target) return json({ ok: false, version: VERSION, fundingPage: true, rpc: 'missing HELIUS_API_KEY secret' }, 200);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
    });
    const body = await res.json().catch(() => ({}));
    const ok = res.ok && body.result === 'ok';
    return json({ ok, version: VERSION, fundingPage: true, rpc: ok ? 'ok' : `upstream answered ${res.status}` }, 200);
  } catch {
    return json({ ok: false, version: VERSION, fundingPage: true, rpc: 'upstream unreachable' }, 200);
  }
}

function serveAsset(pathname, method) {
  const asset = ASSETS[pathname === '/' ? '/index.html' : pathname];
  if (!asset) return new Response('Not found', { status: 404 });
  const body = asset.b64 ? Uint8Array.from(atob(asset.b64), (c) => c.charCodeAt(0)) : asset.text;
  return new Response(method === 'HEAD' ? null : body, {
    headers: {
      'content-type': asset.type,
      'cache-control': 'public, max-age=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/rpc' || pathname === '/rpc/') return handleRpc(request, env);
    if (pathname === '/health') return handleHealth(env);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    return serveAsset(pathname, request.method);
  },
};
