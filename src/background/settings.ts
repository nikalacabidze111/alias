import type { Connection } from '@solana/web3.js';
import { DEFAULT_LIMITS, type Network } from '../shared/constants';
import { makeConnection } from '../shared/rpc';
import { defaultFundingPage, LOCAL_FUNDING_PAGE } from '../shared/hosting';
import type { SettingsState } from '../shared/messages';

const SETTINGS_KEY = 'settings.v1';

export const DEFAULT_SETTINGS: SettingsState = {
  network: 'devnet',
  mainnetEnabled: false,
  perOperationSol: DEFAULT_LIMITS.perOperationSol,
  perTransactionSol: DEFAULT_LIMITS.perTransactionSol,
  companionUrl: defaultFundingPage(),
};

export async function getSettings(): Promise<SettingsState> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const merged = { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<SettingsState> | undefined) ?? {}) };
  // Installs saved with the old local funding page move to the hosted one.
  if (merged.companionUrl.replace(/\/+$/, '') === LOCAL_FUNDING_PAGE && DEFAULT_SETTINGS.companionUrl !== LOCAL_FUNDING_PAGE) {
    merged.companionUrl = DEFAULT_SETTINGS.companionUrl;
  }
  return merged;
}

export async function updateSettings(patch: Partial<SettingsState>): Promise<SettingsState> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  // Guard: switching to mainnet requires the explicit consent flag.
  if (next.network === 'mainnet-beta' && !next.mainnetEnabled) {
    throw new Error('Enable mainnet first (Settings → Enable mainnet)');
  }
  // Guard: a custom RPC must be a plain https URL (or empty to use the defaults).
  if (next.customRpc !== undefined) {
    next.customRpc = next.customRpc.trim();
    if (next.customRpc && !/^https:\/\/[^\s]+$/.test(next.customRpc)) {
      throw new Error('Your own RPC must be an https:// address');
    }
  }
  // Guard: limits must stay positive and sane.
  if (!(next.perOperationSol > 0) || !(next.perTransactionSol > 0)) {
    throw new Error('Limits must be positive');
  }
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getNetwork(): Promise<Network> {
  return (await getSettings()).network;
}

// Every RPC call goes through the fallback list (user's own RPC first).
export async function getConnection(): Promise<Connection> {
  const s = await getSettings();
  return makeConnection(s.network, s.customRpc);
}
