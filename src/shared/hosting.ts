// The hosted Alias server (Cloudflare Worker): funding page at "/" and the
// Solana RPC relay at "/rpc". Set in alias.config.json and baked in at build
// time; empty means local funding page + public RPC servers.
declare const __ALIAS_SERVER__: string | undefined;

export const ALIAS_SERVER: string = typeof __ALIAS_SERVER__ === 'string' ? __ALIAS_SERVER__ : '';

export const LOCAL_FUNDING_PAGE = 'http://localhost:8765';

export function defaultFundingPage(server = ALIAS_SERVER): string {
  return server || LOCAL_FUNDING_PAGE;
}

export function relayRpcUrl(server = ALIAS_SERVER): string | null {
  return server ? `${server}/rpc` : null;
}
