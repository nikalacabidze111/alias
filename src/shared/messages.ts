// Typed message protocol between page <-> content relay <-> background <-> popup/ops/companion.
import type { AliasKind, Network } from './constants';

// ---------- window.postMessage channel (page world <-> relay) ----------
export const CHANNEL_TO_RELAY = 'alias:to-extension';
export const CHANNEL_FROM_RELAY = 'alias:from-extension';

export interface PageRequest {
  channel: typeof CHANNEL_TO_RELAY;
  id: string;
  method:
    | 'connect'
    | 'disconnect'
    | 'signTransaction'
    | 'signAllTransactions'
    | 'signAndSendTransaction'
    | 'signMessage'
    | 'companionReady'
    | 'companionWallet'
    | 'companionSigned'
    | 'companionError';
  params?: unknown;
}

export interface PageResponse {
  channel: typeof CHANNEL_FROM_RELAY;
  id: string;
  ok: boolean;
  result?: unknown;
  error?: { code: number; message: string };
}

// Events pushed from extension to page (no id).
export interface PageEvent {
  channel: typeof CHANNEL_FROM_RELAY;
  event: 'accountChanged' | 'disconnected' | 'companionTask';
  data?: unknown;
}

// ---------- runtime messages (relay/popup/ops -> background) ----------
export interface AliasInfo {
  id: string;
  name: string;
  kind: AliasKind;
  address: string;
  index: number; // derivation index
  avatarSeed: number;
  emoji?: string; // chosen by the user; otherwise a default per kind
  createdAt: number;
}

export interface SettingsState {
  network: Network;
  mainnetEnabled: boolean;
  perOperationSol: number;
  perTransactionSol: number;
  customRpc?: string;
  companionUrl: string;
}

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export type OpKind = 'fund' | 'return';
export type OpStep =
  | 'created'
  | 'awaiting-wallet'
  | 'proving-deposit'
  | 'awaiting-signature'
  | 'deposit-submitted'
  | 'deposit-confirmed'
  | 'proving-withdraw'
  | 'withdraw-submitted'
  | 'withdraw-confirmed'
  | 'done'
  | 'failed'
  | 'unknown';

export interface OperationRecord {
  id: string;
  kind: OpKind;
  aliasId: string;
  amountLamports: number;
  feeLamports?: number;
  netLamports?: number;
  mainWallet?: string; // depositor (fund) or destination (return)
  mainWalletName?: string; // e.g. "Phantom", recorded when the main wallet is picked
  // Timing split: the pool pays out this many minutes after the deposit confirms.
  delayMinutes?: number;
  payAfter?: number; // set once the deposit confirms; the payout waits until then
  step: OpStep;
  stepNote?: string;
  depositTx?: string;
  withdrawTx?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  network: Network;
}

export interface ConnectApprovalRequest {
  requestId: string;
  origin: string;
  siteLabel?: string;
  recommendedAliasId?: string;
  recommendedReason?: string;
  recommendedKind?: AliasKind;
  tabId: number;
}

export interface TxApprovalRequest {
  requestId: string;
  origin: string;
  aliasId: string;
  mode: 'sign' | 'signAndSend';
  txBase64: string;
  tabId: number;
}

export interface MsgApprovalRequest {
  requestId: string;
  origin: string;
  aliasId: string;
  messageBase64: string;
  tabId: number;
}

export interface SimulatedEffect {
  kind: 'sol' | 'token';
  mint?: string;
  symbol?: string;
  decimals?: number;
  delta: string; // signed base-unit amount as decimal string
  uiDelta: string; // human-readable signed amount
}

export interface SimulationResult {
  ok: boolean;
  effects: SimulatedEffect[];
  feeLamports?: number;
  logsTail?: string[];
  error?: string;
  writableUnknown?: boolean; // true if effects could not be fully established
}

// Background RPC: a single message shape with a `type` discriminator.
export type BgRequest =
  | { type: 'vault.status' }
  | { type: 'vault.create'; password: string }
  | { type: 'vault.unlock'; password: string }
  | { type: 'vault.lock' }
  | { type: 'vault.revealMnemonic'; password: string }
  | { type: 'vault.importMnemonic'; password: string; mnemonic: string }
  | { type: 'alias.list' }
  | { type: 'alias.create'; name: string; kind: AliasKind; emoji?: string }
  | { type: 'alias.update'; id: string; name?: string; emoji?: string }
  | { type: 'alias.rename'; id: string; name: string }
  | { type: 'alias.balance'; id: string }
  | { type: 'settings.get' }
  | { type: 'settings.update'; patch: Partial<SettingsState> }
  | { type: 'origins.list' }
  | { type: 'origins.revoke'; origin: string }
  | { type: 'approval.get'; requestId: string }
  | { type: 'approval.resolveConnect'; requestId: string; approved: boolean; aliasId?: string }
  | { type: 'approval.resolveTx'; requestId: string; approved: boolean }
  | { type: 'approval.resolveMsg'; requestId: string; approved: boolean }
  | { type: 'tx.simulate'; txBase64: string; aliasAddress: string }
  | {
      type: 'ops.start';
      kind: OpKind;
      aliasId: string;
      amountLamports: number;
      destination?: string;
      delayMinutes?: number;
    }
  | { type: 'ops.open'; id: string; payNow?: boolean } // open the operation window again
  | { type: 'ops.schedulePay'; id: string; when: number } // remind the user when the payout is due
  | { type: 'ops.get'; id: string }
  | { type: 'ops.list' }
  | { type: 'ops.update'; record: OperationRecord }
  | { type: 'ops.aliasSecret'; aliasId: string } // ops page only: returns secret key for SDK use
  | { type: 'ops.companionConnect'; opId: string } // ask companion tab for the chosen wallet
  | { type: 'ops.companionSign'; opId: string; txBase64: string } // ask companion to sign with main wallet
  | { type: 'ops.recheck'; id: string }
  // Can the pool history scan be skipped for this alias? (true only when it provably owns nothing there)
  | { type: 'ops.scanHint'; aliasId: string }
  // ops page -> companion tab: mirror progress so the funding page never spins silently
  | { type: 'ops.companionStatus'; opId: string; text: string; state: 'working' | 'failed' | 'done' }
  | { type: 'ping' };

export interface BgError {
  code: number;
  message: string;
}

export interface BgResponse<T = unknown> {
  ok: boolean;
  result?: T;
  error?: BgError;
}

export const ERR = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED: 4200,
  DISCONNECTED: 4900,
  LOCKED: 4901,
  INTERNAL: 5000,
  LIMIT: 5001,
  NETWORK: 5002,
} as const;

export function bgCall<T = unknown>(req: BgRequest): Promise<BgResponse<T>> {
  return chrome.runtime.sendMessage(req) as Promise<BgResponse<T>>;
}
