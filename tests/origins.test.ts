import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock } from './chrome-mock';
import type { AliasInfo } from '../src/shared/messages';

beforeEach(() => {
  installChromeMock();
});

function alias(kind: AliasInfo['kind'], id: string = kind): AliasInfo {
  return { id, name: `${kind} alias`, kind, address: 'A'.repeat(32), index: 0, avatarSeed: 1, createdAt: 0 };
}

describe('origin grants', () => {
  it('matches exact origins only — no substring tricks', async () => {
    const origins = await import('../src/background/origins');
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: 't1', network: 'mainnet-beta', grantedAt: 1 });

    expect(await origins.getGrant('https://jup.ag', 'mainnet-beta')).toBeTruthy();
    // Lookalike and derived origins never match.
    expect(await origins.getGrant('https://jup.ag.evil.com', 'mainnet-beta')).toBeUndefined();
    expect(await origins.getGrant('https://evil-jup.ag', 'mainnet-beta')).toBeUndefined();
    expect(await origins.getGrant('https://sub.jup.ag', 'mainnet-beta')).toBeUndefined();
    expect(await origins.getGrant('http://jup.ag', 'mainnet-beta')).toBeUndefined();
    expect(await origins.getGrant('https://jup.ag:8443', 'mainnet-beta')).toBeUndefined();
  });

  it('scopes grants by network', async () => {
    const origins = await import('../src/background/origins');
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: 't1', network: 'devnet', grantedAt: 1 });
    expect(await origins.getGrant('https://jup.ag', 'mainnet-beta')).toBeUndefined();
    expect((await origins.getGrant('https://jup.ag', 'devnet'))?.aliasId).toBe('t1');
  });

  it('replaces a grant for the same origin+network and revokes cleanly', async () => {
    const origins = await import('../src/background/origins');
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: 'old', network: 'mainnet-beta', grantedAt: 1 });
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: 'new', network: 'mainnet-beta', grantedAt: 2 });
    expect(await origins.listGrants()).toHaveLength(1);
    expect((await origins.getGrant('https://jup.ag', 'mainnet-beta'))?.aliasId).toBe('new');

    await origins.revokeGrant('https://jup.ag');
    expect(await origins.getGrant('https://jup.ag', 'mainnet-beta')).toBeUndefined();
  });
});

describe('alias recommendation', () => {
  it('recommends Trading for a recognized trading origin, reusing an existing alias', async () => {
    const { recommendForOrigin } = await import('../src/background/origins');
    const rec = recommendForOrigin('https://jup.ag', [alias('everyday'), alias('trading')]);
    expect(rec.kind).toBe('trading');
    expect(rec.aliasId).toBe('trading');
    expect(rec.siteLabel).toBeTruthy();
  });

  it('recommends a fresh alias for unknown origins — including lookalikes of known ones', async () => {
    const { recommendForOrigin } = await import('../src/background/origins');
    for (const origin of ['https://totally-new.app', 'https://jup.ag.evil.com', 'https://xn--jp-oka.ag']) {
      const rec = recommendForOrigin(origin, [alias('trading')]);
      expect(rec.kind).toBe('fresh');
      expect(rec.aliasId).toBeUndefined();
    }
  });

  it('recommends Collecting for recognized NFT origins when configured', async () => {
    const { recommendForOrigin } = await import('../src/background/origins');
    const { KNOWN_ORIGINS } = await import('../src/shared/constants');
    const nft = KNOWN_ORIGINS.find((r) => r.kind === 'collecting');
    if (!nft) return; // none configured; nothing to test
    const rec = recommendForOrigin(nft.origin, [alias('collecting', 'c1')]);
    expect(rec.kind).toBe('collecting');
    expect(rec.aliasId).toBe('c1');
  });
});
