import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock, type ChromeMock } from './chrome-mock';

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChromeMock();
});

async function freshVault() {
  const vault = await import('../src/background/vault');
  return vault;
}

describe('vault', () => {
  it('creates a vault, stores only ciphertext, and unlocks with the password', async () => {
    const vault = await freshVault();
    const { mnemonic } = await vault.createVault('correct horse battery');
    expect(mnemonic.split(' ')).toHaveLength(12);
    expect(await vault.isUnlocked()).toBe(true);

    // At rest: no plaintext mnemonic anywhere in local storage.
    const raw = JSON.stringify(Object.fromEntries(chrome.storage.local._data));
    for (const word of mnemonic.split(' ')) {
      expect(raw).not.toContain(`"${word}"`);
    }
    expect(raw).not.toContain(mnemonic);

    await vault.lock();
    expect(await vault.isUnlocked()).toBe(false);
    await vault.unlock('correct horse battery');
    expect(await vault.isUnlocked()).toBe(true);
  });

  it('rejects a wrong password and short passwords', async () => {
    const vault = await freshVault();
    await vault.createVault('correct horse battery');
    await vault.lock();
    await expect(vault.unlock('wrong password!')).rejects.toThrow('Wrong password');
    await expect(vault.createVault('short')).rejects.toThrow(/at least/);
  });

  it('derives the same alias keys after lock/unlock (restart survival)', async () => {
    const vault = await freshVault();
    await vault.createVault('correct horse battery');
    const before = (await vault.deriveAliasKeypair(0)).publicKey.toBase58();
    const before2 = (await vault.deriveAliasKeypair(1)).publicKey.toBase58();
    expect(before).not.toBe(before2);

    await vault.lock();
    // Locked: deriving keys must fail, not return anything.
    await expect(vault.deriveAliasKeypair(0)).rejects.toThrow('locked');

    await vault.unlock('correct horse battery');
    expect((await vault.deriveAliasKeypair(0)).publicKey.toBase58()).toBe(before);
    expect((await vault.deriveAliasKeypair(1)).publicKey.toBase58()).toBe(before2);
  });

  it('imports a mnemonic and derives identical keys from it (recovery)', async () => {
    const vault = await freshVault();
    const { mnemonic } = await vault.createVault('correct horse battery');
    const original = (await vault.deriveAliasKeypair(3)).publicKey.toBase58();

    // Wipe everything (new browser profile) and restore from the phrase.
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    await vault.importVault('a different password', ` ${mnemonic.toUpperCase()} `);
    expect((await vault.deriveAliasKeypair(3)).publicKey.toBase58()).toBe(original);
  });

  it('rejects an invalid recovery phrase', async () => {
    const vault = await freshVault();
    await expect(vault.importVault('a fine password', 'not a real phrase at all')).rejects.toThrow(/not valid/);
  });

  it('reveals the phrase only with the password', async () => {
    const vault = await freshVault();
    const { mnemonic } = await vault.createVault('correct horse battery');
    await expect(vault.revealMnemonic('nope nope nope')).rejects.toThrow('Wrong password');
    expect(await vault.revealMnemonic('correct horse battery')).toBe(mnemonic);
  });

  it('encrypts and decrypts journal JSON with a seed-derived key, locked access fails', async () => {
    const vault = await freshVault();
    await vault.createVault('correct horse battery');
    const key = await vault.deriveStorageKey('operation-journal');
    const payload = { id: 'op1', secretish: 'value' };
    const encrypted = await vault.encryptJson(key, payload);
    expect(encrypted).not.toContain('op1');
    expect(await vault.decryptJson(key, encrypted)).toEqual(payload);

    await vault.lock();
    await expect(vault.deriveStorageKey('operation-journal')).rejects.toThrow('locked');
  });
});
