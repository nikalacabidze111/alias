import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from './chrome-mock';
import { emojiFor, isSingleEmoji, KIND_EMOJI } from '../src/shared/emoji';
import { aliasTile } from '../src/shared/brand';

beforeEach(() => {
  installChromeMock();
});

describe('emoji rules', () => {
  it('accepts exactly one emoji, including multi-code-point ones', () => {
    for (const ok of ['🦊', '🖼️', '👩‍💻', '🇬🇪', '❤️', '👍🏽']) expect(isSingleEmoji(ok)).toBe(true);
    for (const bad of ['', 'a', 'ab', '🦊🦊', '🦊a', '<b>', '1', ' ']) expect(isSingleEmoji(bad)).toBe(false);
  });

  it('falls back to a default per kind, and ignores an invalid stored value', () => {
    expect(emojiFor({ kind: 'trading' })).toBe(KIND_EMOJI.trading);
    expect(emojiFor({ kind: 'fresh', emoji: '🐋' })).toBe('🐋');
    expect(emojiFor({ kind: 'everyday', emoji: 'not emoji' })).toBe(KIND_EMOJI.everyday);
    expect(emojiFor({})).toBeNull();
  });

  it('renders an emoji tile when available, a letter tile otherwise', () => {
    expect(aliasTile({ name: 'Trading', avatarSeed: 1, kind: 'trading' })).toContain('📈');
    expect(aliasTile({ name: 'Trading', avatarSeed: 1 })).toContain('>T<');
  });
});

describe('alias emoji and name updates', () => {
  it('stores a chosen emoji and rejects anything else', async () => {
    const vault = await import('../src/background/vault');
    const aliases = await import('../src/background/aliases');
    await vault.createVault('correct horse battery');
    const a = await aliases.createAlias('', 'trading', '🦊');
    expect(a.emoji).toBe('🦊');
    await expect(aliases.createAlias('', 'trading', 'xx')).rejects.toThrow(/single emoji/);
    const updated = await aliases.updateAlias(a.id, { name: '  Fox  ', emoji: '🐋' });
    expect(updated).toMatchObject({ name: 'Fox', emoji: '🐋' });
    await expect(aliases.updateAlias(a.id, { emoji: '🐋🐋' })).rejects.toThrow(/single emoji/);
    await expect(aliases.updateAlias(a.id, { name: '   ' })).rejects.toThrow(/name/);
    await expect(aliases.updateAlias(a.id, { name: 'x'.repeat(41) })).rejects.toThrow(/40/);
    // The address never changes when the look does.
    expect((await aliases.getAlias(a.id))?.address).toBe(a.address);
  });
});
