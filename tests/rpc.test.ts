// RPC fallback: a server that refuses (403, 429, network error) is skipped,
// the user's own RPC goes first, and real web3.js calls work through it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { endpointsFor, makeConnection, makeFallbackFetch, resetRpcMemory, RPC_FALLBACKS } from '../src/shared/rpc';

beforeEach(() => {
  resetRpcMemory();
  vi.unstubAllGlobals();
});

const forbidden = () =>
  new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: 403, message: 'Access forbidden' }, id: 1 }), { status: 403 });
const balance = (value: number) =>
  new Response(JSON.stringify({ jsonrpc: '2.0', result: { context: { slot: 1 }, value }, id: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('endpointsFor', () => {
  it('puts a valid custom https RPC first and ignores anything else', () => {
    expect(endpointsFor('mainnet-beta', 'https://my.rpc/key')[0]).toBe('https://my.rpc/key');
    expect(endpointsFor('mainnet-beta', 'http://insecure.rpc')).toEqual(RPC_FALLBACKS['mainnet-beta']);
    expect(endpointsFor('mainnet-beta', 'javascript:alert(1)')).toEqual(RPC_FALLBACKS['mainnet-beta']);
    expect(endpointsFor('mainnet-beta')).not.toContain(undefined);
    // The endpoint that refused you is last, not first.
    expect(RPC_FALLBACKS['mainnet-beta'].at(-1)).toBe('https://api.mainnet-beta.solana.com');
  });
});

describe('makeFallbackFetch', () => {
  it('skips a 403 server and remembers the one that worked', async () => {
    const calls: string[] = [];
    const base = vi.fn(async (url: string) => {
      calls.push(url);
      return url === 'https://a' ? forbidden() : balance(5);
    });
    const f = makeFallbackFetch(['https://a', 'https://b'], base as unknown as typeof fetch);
    expect((await f('ignored', { method: 'POST', body: '{}' })).status).toBe(200);
    expect(calls).toEqual(['https://a', 'https://b']);
    calls.length = 0;
    await f('ignored', { method: 'POST', body: '{}' });
    expect(calls).toEqual(['https://b']); // sticky
  });

  it('moves on after a network error and a rate limit', async () => {
    const base = vi.fn(async (url: string) => {
      if (url === 'https://a') throw new TypeError('Failed to fetch');
      if (url === 'https://b') return new Response('slow down', { status: 429 });
      return balance(1);
    });
    const f = makeFallbackFetch(['https://a', 'https://b', 'https://c'], base as unknown as typeof fetch);
    expect((await f('x', {})).status).toBe(200);
  });

  it('returns the last refusal when every server refuses (readable error, no hang)', async () => {
    const f = makeFallbackFetch(['https://a', 'https://b'], (async () => forbidden()) as unknown as typeof fetch);
    expect((await f('x', {})).status).toBe(403);
  });

  it('a real web3.js call succeeds when the first server answers 403', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        seen.push(url);
        if (url === RPC_FALLBACKS['mainnet-beta'][0]) return forbidden();
        const { id } = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ jsonrpc: '2.0', result: { context: { slot: 1 }, value: 42_000 }, id }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );
    const connection = makeConnection('mainnet-beta');
    expect(await connection.getBalance(Keypair.generate().publicKey)).toBe(42_000);
    expect(seen.slice(0, 2)).toEqual(RPC_FALLBACKS['mainnet-beta'].slice(0, 2));
  });
});

describe('hosted Alias relay', () => {
  it('goes first on mainnet (after your own RPC) and never on devnet', () => {
    const relay = 'https://alias.example.workers.dev/rpc';
    expect(endpointsFor('mainnet-beta', undefined, relay)[0]).toBe(relay);
    expect(endpointsFor('mainnet-beta', 'https://mine.rpc/k', relay).slice(0, 2)).toEqual(['https://mine.rpc/k', relay]);
    expect(endpointsFor('devnet', undefined, relay)).not.toContain(relay);
    expect(endpointsFor('mainnet-beta', undefined, null)).toEqual(RPC_FALLBACKS['mainnet-beta']);
  });
});
