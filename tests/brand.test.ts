import { describe, expect, it } from 'vitest';
import { aliasTile, initialOf, markSvg, siteTile } from '../src/shared/brand';

describe('brand mark and tiles', () => {
  it('draws the mark with or without its lilac tile', () => {
    expect(markSvg(40)).toContain('#AE94F6');
    expect(markSvg(40, { tile: false })).not.toContain('<rect');
    expect(markSvg(40)).toContain('width="40"');
  });

  it('picks a sensible initial', () => {
    expect(initialOf('Trading Alias')).toBe('T');
    expect(initialOf('jup.ag Alias')).toBe('J');
    expect(initialOf('  #42 test')).toBe('4');
    expect(initialOf('')).toBe('A');
  });

  it('escapes names and never puts a lilac tile on the lilac card', () => {
    expect(aliasTile({ name: '<script>', avatarSeed: 1 })).not.toContain('<script>');
    for (const seed of [0, 3, 4, 7]) {
      expect(aliasTile({ name: 'X', avatarSeed: seed }, 36, true)).toContain('tile-1');
    }
    expect(aliasTile({ name: 'X', avatarSeed: 2 }, 36, true)).toContain('tile-2');
  });

  it('site tiles use the host letter and never load a favicon', () => {
    const t = siteTile('www.jup.ag');
    expect(t).toContain('>J<');
    expect(t).not.toMatch(/<img|https?:/);
  });
});
