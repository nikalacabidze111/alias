// Encrypted vault: a BIP39 mnemonic protected by a password.
// - At rest: AES-256-GCM, key derived with PBKDF2-SHA256 (600k iterations).
// - Unlocked: the 64-byte BIP39 seed lives only in chrome.storage.session
//   (memory-backed, trusted contexts only, cleared when the browser closes).
// - Alias keys are derived on demand (m/44'/501'/i'/0') and never persisted.

import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { derivePath } from 'ed25519-hd-key';
import { Keypair } from '@solana/web3.js';
import { AUTO_LOCK_MINUTES, MIN_PASSWORD_LENGTH, derivationPath } from '../shared/constants';

const VAULT_KEY = 'vault.v1';
// 'created': the 12 words were generated here, so none of its keys can own
// anything in the Privacy Cash pool from before. 'imported' or missing: unknown.
const VAULT_ORIGIN_KEY = 'vault.origin';
const SESSION_SEED_KEY = 'session.seed';
const PBKDF2_ITERATIONS = 600_000;

export interface VaultFile {
  version: 1;
  kdf: { algo: 'PBKDF2-SHA256'; salt: string; iterations: number };
  cipher: { algo: 'AES-256-GCM'; iv: string; data: string };
  createdAt: number;
}

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function deriveAesKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function vaultExists(): Promise<boolean> {
  const stored = await chrome.storage.local.get(VAULT_KEY);
  return Boolean(stored[VAULT_KEY]);
}

export async function isUnlocked(): Promise<boolean> {
  const stored = await chrome.storage.session.get(SESSION_SEED_KEY);
  return Boolean(stored[SESSION_SEED_KEY]);
}

async function setSessionSeed(seed: Uint8Array): Promise<void> {
  await chrome.storage.session.set({ [SESSION_SEED_KEY]: b64(seed) });
  await armAutoLock();
}

export async function getSessionSeed(): Promise<Uint8Array | null> {
  const stored = await chrome.storage.session.get(SESSION_SEED_KEY);
  const value = stored[SESSION_SEED_KEY];
  if (!value) return null;
  return fromB64(value as string);
}

export async function lock(): Promise<void> {
  await chrome.storage.session.remove(SESSION_SEED_KEY);
}

export async function armAutoLock(): Promise<void> {
  await chrome.alarms.create('auto-lock', { delayInMinutes: AUTO_LOCK_MINUTES });
}

export async function touchActivity(): Promise<void> {
  if (await isUnlocked()) await armAutoLock();
}

async function encryptMnemonic(mnemonic: string, password: string): Promise<VaultFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, PBKDF2_ITERATIONS);
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(mnemonic),
  );
  return {
    version: 1,
    kdf: { algo: 'PBKDF2-SHA256', salt: b64(salt), iterations: PBKDF2_ITERATIONS },
    cipher: { algo: 'AES-256-GCM', iv: b64(iv), data: b64(data) },
    createdAt: Date.now(),
  };
}

async function decryptMnemonic(file: VaultFile, password: string): Promise<string> {
  const key = await deriveAesKey(password, fromB64(file.kdf.salt), file.kdf.iterations);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(file.cipher.iv) as BufferSource },
    key,
    fromB64(file.cipher.data) as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

export async function createVault(password: string): Promise<{ mnemonic: string }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (await vaultExists()) throw new Error('A vault already exists');
  const mnemonic = generateMnemonic(wordlist, 128); // 12 words
  const file = await encryptMnemonic(mnemonic, password);
  await chrome.storage.local.set({ [VAULT_KEY]: file, [VAULT_ORIGIN_KEY]: 'created' });
  const seed = await mnemonicToSeed(mnemonic);
  await setSessionSeed(seed);
  return { mnemonic };
}

export async function importVault(password: string, mnemonic: string): Promise<void> {
  const normalized = mnemonic.trim().toLowerCase().split(/\s+/).join(' ');
  if (!validateMnemonic(normalized, wordlist)) throw new Error('That recovery phrase is not valid');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  const file = await encryptMnemonic(normalized, password);
  await chrome.storage.local.set({ [VAULT_KEY]: file, [VAULT_ORIGIN_KEY]: 'imported' });
  const seed = await mnemonicToSeed(normalized);
  await setSessionSeed(seed);
}

export async function unlock(password: string): Promise<void> {
  const stored = await chrome.storage.local.get(VAULT_KEY);
  const file = stored[VAULT_KEY] as VaultFile | undefined;
  if (!file) throw new Error('No vault yet');
  let mnemonic: string;
  try {
    mnemonic = await decryptMnemonic(file, password);
  } catch {
    throw new Error('Wrong password');
  }
  const seed = await mnemonicToSeed(mnemonic);
  await setSessionSeed(seed);
}

export async function vaultOrigin(): Promise<'created' | 'imported' | 'unknown'> {
  const stored = await chrome.storage.local.get(VAULT_ORIGIN_KEY);
  const v = stored[VAULT_ORIGIN_KEY];
  return v === 'created' || v === 'imported' ? v : 'unknown';
}

// Requires the password again: revealing the phrase is a deliberate act.
export async function revealMnemonic(password: string): Promise<string> {
  const stored = await chrome.storage.local.get(VAULT_KEY);
  const file = stored[VAULT_KEY] as VaultFile | undefined;
  if (!file) throw new Error('No vault yet');
  try {
    return await decryptMnemonic(file, password);
  } catch {
    throw new Error('Wrong password');
  }
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function deriveAliasKeypair(index: number): Promise<Keypair> {
  const seed = await getSessionSeed();
  if (!seed) throw new Error('Vault is locked');
  const { key } = derivePath(derivationPath(index), toHex(seed));
  return Keypair.fromSeed(new Uint8Array(key));
}

// HKDF a purpose-specific 256-bit AES key from the seed (e.g. for the operation journal).
export async function deriveStorageKey(info: string): Promise<CryptoKey> {
  const seed = await getSessionSeed();
  if (!seed) throw new Error('Vault is locked');
  const material = await crypto.subtle.importKey('raw', seed as BufferSource, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('alias-storage-v1'),
      info: new TextEncoder().encode(info),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return `${b64(iv)}.${b64(data)}`;
}

export async function decryptJson<T>(key: CryptoKey, payload: string): Promise<T> {
  const [ivB64, dataB64] = payload.split('.');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) as BufferSource },
    key,
    fromB64(dataB64) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}
