// Privacy Cash integration for the ops page. Uses the audited `privacycash`
// SDK (v1.2.3) low-level functions directly. The shielded account is derived
// from the ALIAS keypair, so the alias owns the pooled funds; the main wallet
// only ever signs its own deposit transaction.
import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { WasmFactory } from '@lightprotocol/hasher.rs';
import {
  deposit,
  withdraw,
  getUtxos,
  getConfig,
  EncryptionService,
  setLogger,
  localstorageKey,
} from 'privacycash/utils';
import { PRIVACY_CASH_RELAYER } from '../shared/constants';
import BN from 'bn.js';

export interface PrivacyLog {
  level: string;
  message: string;
}

let logSink: ((entry: PrivacyLog) => void) | null = null;

export function onPrivacyLog(sink: (entry: PrivacyLog) => void): void {
  logSink = sink;
  setLogger((level: string, message: string) => {
    logSink?.({ level, message });
  });
}

// ---------- circuit integrity ----------
export interface CircuitCheck {
  keyBasePath: string;
  verified: { name: string; sha256: string; bytes: number }[];
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyCircuits(): Promise<CircuitCheck> {
  const manifestUrl = chrome.runtime.getURL('circuits/manifest.json');
  const manifestRes = await fetch(manifestUrl);
  if (!manifestRes.ok) throw new Error('Proof files are missing from this build');
  const manifest = (await manifestRes.json()) as Record<string, { sha256: string; bytes: number }>;
  const verified: CircuitCheck['verified'] = [];
  for (const name of ['transaction2.wasm', 'transaction2.zkey']) {
    const expected = manifest[name];
    if (!expected) throw new Error(`Proof file ${name} is not in the build manifest`);
    const res = await fetch(chrome.runtime.getURL(`circuits/${name}`));
    if (!res.ok) throw new Error(`Proof file ${name} failed to load`);
    const buf = await res.arrayBuffer();
    const hash = await sha256Hex(buf);
    if (hash !== expected.sha256 || buf.byteLength !== expected.bytes) {
      throw new Error(`Proof file ${name} failed its integrity check`);
    }
    verified.push({ name, sha256: hash, bytes: buf.byteLength });
  }
  return { keyBasePath: chrome.runtime.getURL('circuits/transaction2'), verified };
}

// ---------- pool scan start ----------
// The SDK remembers how far it has scanned the pool per owner under this key
// (privacycash/dist/getUtxos.js: LSK_FETCH_OFFSET + localstorageKey(pubkey)).
export const SDK_FETCH_OFFSET_PREFIX = 'fetch_offset';

export function scanOffsetKey(owner: PublicKey): string {
  return SDK_FETCH_OFFSET_PREFIX + localstorageKey(owner);
}

// Number of encrypted outputs in the pool right now (the relayer reports it
// as `total` on every range response).
export async function poolOutputCount(): Promise<number | null> {
  try {
    const res = await fetch(`${PRIVACY_CASH_RELAYER}/utxos/range?start=0&end=1`);
    if (!res.ok) return null;
    const data = (await res.json()) as { total?: unknown };
    return typeof data.total === 'number' && data.total >= 0 ? data.total : null;
  } catch {
    return null;
  }
}

// For an alias that provably owns nothing in the pool, start the SDK's first
// scan at the pool's current end instead of downloading its whole history.
// Returns what happened, for the progress line.
export async function prepareFirstScan(owner: PublicKey, canSkip: () => Promise<boolean>): Promise<'resumed' | 'skipped' | 'full'> {
  const key = scanOffsetKey(owner);
  if (localStorage.getItem(key) !== null) return 'resumed';
  if (!(await canSkip())) return 'full';
  const total = await poolOutputCount();
  if (total === null) return 'full';
  localStorage.setItem(key, String(total));
  return 'skipped';
}

// ---------- shielded account ----------
export function encryptionServiceForAlias(aliasKeypair: Keypair): EncryptionService {
  const service = new EncryptionService();
  service.deriveEncryptionKeyFromWallet(aliasKeypair);
  return service;
}

export async function shieldedBalanceLamports(
  connection: Connection,
  aliasKeypair: Keypair,
  abortSignal?: AbortSignal,
): Promise<number> {
  const encryptionService = encryptionServiceForAlias(aliasKeypair);
  const utxos = await getUtxos({
    connection,
    publicKey: aliasKeypair.publicKey,
    encryptionService,
    storage: localStorage,
    abortSignal,
  });
  return utxos.reduce((sum: BN, u: { amount: BN }) => sum.add(u.amount), new BN(0)).toNumber();
}

export async function liveConfig(): Promise<{
  withdrawFeeRate: number;
  withdrawRentFeeSol: number;
  minimumSol: number;
}> {
  const withdrawFeeRate = await getConfig('withdraw_fee_rate');
  const withdrawRentFeeSol = await getConfig('withdraw_rent_fee');
  let minimumSol = 0;
  try {
    const minimums = await getConfig('minimum_withdrawal');
    if (typeof minimums?.sol === 'number') minimumSol = minimums.sol;
  } catch {
    // No minimum reported; the relayer will still enforce its own rules.
  }
  return { withdrawFeeRate, withdrawRentFeeSol, minimumSol };
}

export function poolFeeLamports(amountLamports: number, cfg: { withdrawFeeRate: number; withdrawRentFeeSol: number }): number {
  return Math.floor(amountLamports * cfg.withdrawFeeRate + cfg.withdrawRentFeeSol * 1e9);
}

// ---------- deposit / withdraw ----------
export interface DepositArgs {
  connection: Connection;
  amountLamports: number;
  aliasKeypair: Keypair; // owns the shielded account
  signerPubkey: PublicKey; // pays the deposit (main wallet for fund, alias for return)
  keyBasePath: string;
  // Receives the fully built unsigned transaction; must return it signed.
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
}

export async function runDeposit(args: DepositArgs): Promise<{ tx: string }> {
  const encryptionService = encryptionServiceForAlias(args.aliasKeypair);
  const lightWasm = await WasmFactory.getInstance();
  return deposit({
    lightWasm,
    storage: localStorage,
    keyBasePath: args.keyBasePath,
    publicKey: args.aliasKeypair.publicKey,
    connection: args.connection,
    amount_in_lamports: args.amountLamports,
    encryptionService,
    transactionSigner: args.signTransaction,
    signer: args.signerPubkey,
  });
}

export interface WithdrawArgs {
  connection: Connection;
  amountLamports: number; // gross; the relayer fee is taken out of this
  aliasKeypair: Keypair;
  recipient: PublicKey;
  keyBasePath: string;
}

export interface WithdrawResult {
  isPartial: boolean;
  tx: string;
  recipient: string;
  amount_in_lamports: number;
  fee_in_lamports: number;
}

export async function runWithdraw(args: WithdrawArgs): Promise<WithdrawResult> {
  const encryptionService = encryptionServiceForAlias(args.aliasKeypair);
  const lightWasm = await WasmFactory.getInstance();
  return withdraw({
    recipient: args.recipient,
    lightWasm,
    storage: localStorage,
    publicKey: args.aliasKeypair.publicKey,
    connection: args.connection,
    amount_in_lamports: args.amountLamports,
    encryptionService,
    keyBasePath: args.keyBasePath,
  }) as Promise<WithdrawResult>;
}

// Verify a signed transaction returned by an external wallet: the message must
// be byte-identical to what we built, and the fee payer's signature must verify.
export function verifyExternalSignature(
  unsigned: VersionedTransaction,
  signedBytes: Uint8Array,
  expectedSigner: PublicKey,
  verifyFn: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean,
): VersionedTransaction {
  const signed = VersionedTransaction.deserialize(signedBytes);
  const unsignedMsg = unsigned.message.serialize();
  const signedMsg = signed.message.serialize();
  if (unsignedMsg.length !== signedMsg.length || !unsignedMsg.every((b, i) => b === signedMsg[i])) {
    throw new Error('The wallet returned a different transaction than the one we sent. Nothing was submitted.');
  }
  const feePayer = signed.message.staticAccountKeys[0];
  if (!feePayer.equals(expectedSigner)) {
    throw new Error('The signed transaction is not from the selected main wallet. Nothing was submitted.');
  }
  const signature = signed.signatures[0];
  if (!signature || !verifyFn(signedMsg, signature, expectedSigner.toBytes())) {
    throw new Error('The signature from the wallet did not verify. Nothing was submitted.');
  }
  return signed;
}
