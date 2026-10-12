import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock, type ChromeMock } from './chrome-mock';
import type { OperationRecord } from '../src/shared/messages';

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChromeMock();
});

function record(id: string, step: OperationRecord['step']): OperationRecord {
  return {
    id,
    kind: 'fund',
    aliasId: 'a1',
    amountLamports: 50_000_000,
    step,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    network: 'mainnet-beta',
  };
}

describe('operation journal', () => {
  it('requires an unlocked vault to write, and reads nothing while locked', async () => {
    const vault = await import('../src/background/vault');
    const journal = await import('../src/background/journal');
    await expect(journal.putOperation(record('op1', 'created'))).rejects.toThrow('locked');

    await vault.createVault('correct horse battery');
    await journal.putOperation(record('op1', 'created'));
    expect(await journal.listOperations()).toHaveLength(1);

    await vault.lock();
    expect(await journal.listOperations()).toHaveLength(0); // hidden, not deleted
    await vault.unlock('correct horse battery');
    expect(await journal.listOperations()).toHaveLength(1);
  });

  it('stores entries encrypted — no transaction ids or steps in plaintext', async () => {
    const vault = await import('../src/background/vault');
    const journal = await import('../src/background/journal');
    await vault.createVault('correct horse battery');
    const r = { ...record('op-plain-check', 'deposit-submitted'), depositTx: '5SignatureABCDEF' };
    await journal.putOperation(r);
    const raw = JSON.stringify(Object.fromEntries(chrome.storage.local._data));
    expect(raw).not.toContain('op-plain-check');
    expect(raw).not.toContain('5SignatureABCDEF');
    expect(raw).not.toContain('deposit-submitted');
  });

  it('updates in place by id and keeps newest first', async () => {
    const vault = await import('../src/background/vault');
    const journal = await import('../src/background/journal');
    await vault.createVault('correct horse battery');
    const first = record('op1', 'created');
    first.createdAt = 1000;
    await journal.putOperation(first);
    const second = record('op2', 'created');
    second.createdAt = 2000;
    await journal.putOperation(second);
    await journal.putOperation({ ...first, step: 'deposit-submitted', depositTx: 'sig1' });

    const list = await journal.listOperations();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe('op2');
    expect(list[1].step).toBe('deposit-submitted');
    expect(list[1].depositTx).toBe('sig1');
  });

  it('skips entries that no longer decrypt instead of failing the whole journal', async () => {
    const vault = await import('../src/background/vault');
    const journal = await import('../src/background/journal');
    await vault.createVault('correct horse battery');
    await journal.putOperation(record('op1', 'created'));

    const stored = (await chrome.storage.local.get('journal.v1'))['journal.v1'] as { entries: string[] };
    stored.entries.push('garbage.notdecryptable');
    await chrome.storage.local.set({ 'journal.v1': stored });

    const list = await journal.listOperations();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('op1');
  });

  it('flags uncertain operations', async () => {
    const journal = await import('../src/background/journal');
    expect(journal.hasUncertainOperations([record('a', 'done'), record('b', 'failed')])).toBe(false);
    for (const step of ['created', 'deposit-submitted', 'unknown', 'withdraw-submitted'] as const) {
      expect(journal.hasUncertainOperations([record('a', step)])).toBe(true);
    }
  });
});
