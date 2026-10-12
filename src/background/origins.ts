// Per-origin connection grants and alias recommendations.
// Exact-origin rules only: `https://jup.ag` and `https://jup.ag.evil.com` never match each other.
import { KNOWN_ORIGINS, type AliasKind, type Network } from '../shared/constants';
import type { AliasInfo } from '../shared/messages';

const GRANTS_KEY = 'origin-grants.v1';

export interface OriginGrant {
  origin: string;
  aliasId: string;
  network: Network;
  grantedAt: number;
}

export async function listGrants(): Promise<OriginGrant[]> {
  const stored = await chrome.storage.local.get(GRANTS_KEY);
  return (stored[GRANTS_KEY] as OriginGrant[] | undefined) ?? [];
}

export async function getGrant(origin: string, network: Network): Promise<OriginGrant | undefined> {
  return (await listGrants()).find((g) => g.origin === origin && g.network === network);
}

export async function saveGrant(grant: OriginGrant): Promise<void> {
  const grants = (await listGrants()).filter((g) => !(g.origin === grant.origin && g.network === grant.network));
  grants.push(grant);
  await chrome.storage.local.set({ [GRANTS_KEY]: grants });
}

export async function revokeGrant(origin: string): Promise<void> {
  const grants = (await listGrants()).filter((g) => g.origin !== origin);
  await chrome.storage.local.set({ [GRANTS_KEY]: grants });
}

export interface Recommendation {
  kind: AliasKind;
  siteLabel?: string;
  aliasId?: string; // existing alias that fits, if any
  reason: string;
}

// Pure so it is unit-testable.
export function recommendForOrigin(origin: string, aliases: AliasInfo[]): Recommendation {
  const rule = KNOWN_ORIGINS.find((r) => r.origin === origin);
  if (rule) {
    const existing = aliases.find((a) => a.kind === rule.kind);
    return {
      kind: rule.kind,
      siteLabel: rule.label,
      aliasId: existing?.id,
      reason:
        rule.kind === 'trading'
          ? `${rule.label} is a trading app`
          : rule.kind === 'collecting'
            ? `${rule.label} is an NFT app`
            : `${rule.label} is a recognized app`,
    };
  }
  let host = origin;
  try {
    host = new URL(origin).hostname;
  } catch {
    // keep origin as-is
  }
  return {
    kind: 'fresh',
    reason: `New site. A fresh alias keeps ${host} separate from everything else.`,
  };
}
