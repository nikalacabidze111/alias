import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from './chrome-mock';

beforeEach(() => {
  installChromeMock();
});

describe('aliases', () => {
  it('refuses to create an alias while locked', async () => {
    const aliases = await import('../src/background/aliases');
    await expect(aliases.createAlias('Trading', 'trading')).rejects.toThrow('locked');
  });

  it('creates aliases with distinct derivation indices and addresses', async () => {
    const vault = await import('../src/background/vault');
    const aliases = await import('../src/background/aliases');
    await vault.createVault('correct horse battery');

    const a = await aliases.createAlias('Trading', 'trading');
    const b = await aliases.createAlias('', 'collecting');
    expect(a.index).toBe(0);
    expect(b.index).toBe(1);
    expect(b.name).toBe('Collecting Alias');
    expect(a.address).not.toBe(b.address);

    // The stored address matches the derived key for that index, after restart.
    await vault.lock();
    await vault.unlock('correct horse battery');
    const kp = await aliases.aliasKeypairById(a.id);
    expect(kp.publicKey.toBase58()).toBe(a.address);
  });

  it('never stores alias secret keys at rest', async () => {
    const vault = await import('../src/background/vault');
    const aliases = await import('../src/background/aliases');
    await vault.createVault('correct horse battery');
    const a = await aliases.createAlias('Trading', 'trading');
    const kp = await aliases.aliasKeypairById(a.id);
    const secretB64 = Buffer.from(kp.secretKey).toString('base64');
    const raw = JSON.stringify(Object.fromEntries((globalThis as any).chrome.storage.local._data));
    expect(raw).not.toContain(secretB64);
    expect(raw).toContain(a.address); // public info is fine
  });
});
