// Shared constants for Alias.

export type Network = 'devnet' | 'mainnet-beta';

// RPC servers and fallback order live in shared/rpc.ts.

export const EXPLORER_BASE = 'https://solscan.io';

export function explorerTxUrl(signature: string, network: Network): string {
  const suffix = network === 'devnet' ? '?cluster=devnet' : '';
  return `${EXPLORER_BASE}/tx/${signature}${suffix}`;
}

export function explorerAddressUrl(address: string, network: Network): string {
  const suffix = network === 'devnet' ? '?cluster=devnet' : '';
  return `${EXPLORER_BASE}/account/${address}${suffix}`;
}

// Alias kinds and per-origin recommendations.
export type AliasKind = 'trading' | 'collecting' | 'everyday' | 'fresh';

export interface OriginRule {
  origin: string; // exact origin, e.g. https://jup.ag
  kind: AliasKind;
  label: string; // human name of the site
}

// Exact-origin rules only. No substring matching.
export const KNOWN_ORIGINS: OriginRule[] = [
  { origin: 'https://jup.ag', kind: 'trading', label: 'Jupiter' },
  { origin: 'https://lite.jup.ag', kind: 'trading', label: 'Jupiter' },
  { origin: 'https://raydium.io', kind: 'trading', label: 'Raydium' },
  { origin: 'https://www.orca.so', kind: 'trading', label: 'Orca' },
  { origin: 'https://magiceden.io', kind: 'collecting', label: 'Magic Eden' },
  { origin: 'https://www.tensor.trade', kind: 'collecting', label: 'Tensor' },
];

// Privacy Cash runs on Solana mainnet only.
export const PRIVACY_CASH_NETWORK: Network = 'mainnet-beta';
export const PRIVACY_CASH_RELAYER = 'https://api3.privacycash.org';

// Safety limits (SOL). Defaults are deliberately small; user-configurable in settings.
export const DEFAULT_LIMITS = {
  perOperationSol: 0.2,
  perTransactionSol: 0.2,
};

// Auto-lock after this many minutes of inactivity.
export const AUTO_LOCK_MINUTES = 15;

// Solana derivation path for alias keys: m/44'/501'/index'/0'
export function derivationPath(index: number): string {
  return `m/44'/501'/${index}'/0'`;
}

export const MIN_PASSWORD_LENGTH = 8;

// One SOL in lamports.
export const LAMPORTS_PER_SOL = 1_000_000_000;
