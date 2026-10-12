// First-scan shortcut: only an alias that provably owns nothing in the pool
// may start scanning at the pool's current end.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Keypair } from '@solana/web3.js';
import { installChromeMock } from './chrome-mock';
import type { OperationRecord } from '../src/shared/messages';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  installChromeMock();
  (globalThis as Record<string, unknown>).localStorage = memoryStorage();
  vi.unstubAllGlobals();
});

function op(aliasId: string, patch: Partial<OperationRecord> = {}): OperationRecord {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'fund',
    aliasId,
    amountLamports: 1,
    step: 'created',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    network: 'mainnet-beta',
    ...patch,
  };
}

describe('pool history skip rule', () => {
  it('uses the same storage key as the SDK', async () => {
    const { SDK_FETCH_OFFSET_PREFIX, scanOffsetKey } = await import('../src/ops/privacy');
    const sdk = await import('../node_modules/privacycash/dist/utils/constants.js');
    const { localstorageKey } = await import('../node_modules/privacycash/dist/getUtxos.js');
    expect(SDK_FETCH_OFFSET_PREFIX).toBe(sdk.LSK_FETCH_OFFSET);
    const pk = Keypair.generate().publicKey;
    expect(scanOffsetKey(pk)).toBe(sdk.LSK_FETCH_OFFSET + localstorageKey(pk));
  });

  it('allows the skip for a vault created here with no pool activity yet', async () => {
    const vault = await import('../src/background/vault');
    const bg = await import('../src/background/index');
    await vault.createVault('correct horse battery');
    expect(await vault.vaultOrigin()).toBe('created');
    expect(await bg.canSkipPoolHistory('a1')).toBe(true);
  });

  it('refuses once the alias has touched the pool', async () => {
    const vault = await import('../src/background/vault');
    const journal = await import('../src/background/journal');
    const bg = await import('../src/background/index');
    await vault.createVault('correct horse battery');
    await journal.putOperation(op('a1', { depositTx: 'sig' }));
    expect(await bg.canSkipPoolHistory('a1')).toBe(false);
    // Another alias is unaffected; a never-submitted operation does not count.
    await journal.putOperation(op('a2', { step: 'failed' }));
    expect(await bg.canSkipPoolHistory('a2')).toBe(true);
  });

  it('refuses for imported phrases and for vaults of unknown origin', async () => {
    const vault = await import('../src/background/vault');
    const bg = await import('../src/background/index');
    const { mnemonic } = await vault.createVault('correct horse battery');
    await chrome.storage.local.remove('vault.origin');
    expect(await vault.vaultOrigin()).toBe('unknown');
    expect(await bg.canSkipPoolHistory('a1')).toBe(false);
    await vault.importVault('another password', mnemonic);
    expect(await vault.vaultOrigin()).toBe('imported');
    expect(await bg.canSkipPoolHistory('a1')).toBe(false);
  });
});

describe('prepareFirstScan', () => {
  it('starts at the pool end only when allowed and only the first time', async () => {
    const { prepareFirstScan, scanOffsetKey } = await import('../src/ops/privacy');
    const owner = Keypair.generate().publicKey;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ total: 123456, encrypted_outputs: [], hasMore: true }))));

    expect(await prepareFirstScan(owner, async () => false)).toBe('full');
    expect(localStorage.getItem(scanOffsetKey(owner))).toBeNull();

    expect(await prepareFirstScan(owner, async () => true)).toBe('skipped');
    expect(localStorage.getItem(scanOffsetKey(owner))).toBe('123456');

    // Afterwards the SDK's own saved position wins; nothing is overwritten.
    localStorage.setItem(scanOffsetKey(owner), '130000');
    expect(await prepareFirstScan(owner, async () => true)).toBe('resumed');
    expect(localStorage.getItem(scanOffsetKey(owner))).toBe('130000');
  });

  it('falls back to a full scan when the pool size is unavailable', async () => {
    const { prepareFirstScan, scanOffsetKey } = await import('../src/ops/privacy');
    const owner = Keypair.generate().publicKey;
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 503 })));
    expect(await prepareFirstScan(owner, async () => true)).toBe('full');
    expect(localStorage.getItem(scanOffsetKey(owner))).toBeNull();
  });
});
