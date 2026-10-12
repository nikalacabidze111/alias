// Solana RPC access with automatic fallback.
//
// Some public RPC servers refuse requests from browser extensions (for
// example api.mainnet-beta.solana.com answering 403 "Access forbidden") or
// rate-limit them. Every Connection Alias creates goes through a fetch that
// tries the user's own RPC first (Settings), then a list of public servers,
// moving on when one refuses. Extension pages with host permissions are not
// subject to CORS, so only server-side refusals matter here.
import { Connection, type Commitment, type FetchFn } from '@solana/web3.js';
import type { Network } from './constants';

export const RPC_FALLBACKS: Record<Network, string[]> = {
  'mainnet-beta': [
    'https://solana-rpc.publicnode.com',
    'https://solana.api.onfinality.io/public',
    'https://api.mainnet.solana.com',
    'https://api.mainnet-beta.solana.com',
  ],
  devnet: ['https://api.devnet.solana.com'],
};

// HTTP answers that mean "this server will not serve us right now".
const TRY_NEXT = new Set([401, 403, 404, 405, 429, 500, 502, 503, 504]);

export function endpointsFor(network: Network, customRpc?: string): string[] {
  const list = [...RPC_FALLBACKS[network]];
  if (customRpc && /^https:\/\/[^\s]+$/.test(customRpc.trim())) list.unshift(customRpc.trim());
  return [...new Set(list)];
}

// Remember which server last worked, per endpoint list, for this page/worker.
const lastGood = new Map<string, number>();

export function makeFallbackFetch(endpoints: string[], baseFetch?: typeof fetch) {
  const key = endpoints.join('|');
  return async (_input: unknown, init?: RequestInit): Promise<Response> => {
    const doFetch = baseFetch ?? ((url: string, i?: RequestInit) => globalThis.fetch(url, i));
    const start = lastGood.get(key) ?? 0;
    let last: Response | Error | undefined;
    for (let n = 0; n < endpoints.length; n++) {
      const idx = (start + n) % endpoints.length;
      try {
        const res = await doFetch(endpoints[idx], init);
        if (!TRY_NEXT.has(res.status)) {
          lastGood.set(key, idx);
          return res;
        }
        last = res;
      } catch (e) {
        last = e instanceof Error ? e : new Error(String(e));
      }
    }
    if (last instanceof Response) return last; // web3.js turns it into a readable error
    throw last ?? new Error('No Solana RPC server could be reached');
  };
}

export function makeConnection(network: Network, customRpc?: string, commitment: Commitment = 'confirmed'): Connection {
  const endpoints = endpointsFor(network, customRpc);
  return new Connection(endpoints[0], { commitment, fetch: makeFallbackFetch(endpoints) as unknown as FetchFn });
}

// Test hook.
export function resetRpcMemory(): void {
  lastGood.clear();
}
