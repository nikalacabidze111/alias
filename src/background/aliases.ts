// Alias records: public metadata in chrome.storage.local, keys derived from the vault seed.
import { Connection } from '@solana/web3.js';
import type { AliasInfo } from '../shared/messages';
import type { AliasKind } from '../shared/constants';
import { uid } from '../shared/format';
import { isSingleEmoji } from '../shared/emoji';
import { deriveAliasKeypair, getSessionSeed } from './vault';
import { getConnection } from './settings';

const ALIASES_KEY = 'aliases.v1';

export async function listAliases(): Promise<AliasInfo[]> {
  const stored = await chrome.storage.local.get(ALIASES_KEY);
  return (stored[ALIASES_KEY] as AliasInfo[] | undefined) ?? [];
}

async function saveAliases(list: AliasInfo[]): Promise<void> {
  await chrome.storage.local.set({ [ALIASES_KEY]: list });
}

export async function getAlias(id: string): Promise<AliasInfo | undefined> {
  return (await listAliases()).find((a) => a.id === id);
}

export async function createAlias(name: string, kind: AliasKind, emoji?: string): Promise<AliasInfo> {
  if (!(await getSessionSeed())) throw new Error('Vault is locked');
  if (emoji !== undefined && !isSingleEmoji(emoji)) throw new Error('Pick a single emoji');
  const list = await listAliases();
  const index = list.length === 0 ? 0 : Math.max(...list.map((a) => a.index)) + 1;
  const keypair = await deriveAliasKeypair(index);
  const info: AliasInfo = {
    id: uid(),
    name: name.trim() || defaultName(kind),
    kind,
    address: keypair.publicKey.toBase58(),
    index,
    avatarSeed: Math.floor(Math.random() * 1_000_000),
    ...(emoji ? { emoji: emoji.trim() } : {}),
    createdAt: Date.now(),
  };
  list.push(info);
  await saveAliases(list);
  return info;
}

export async function renameAlias(id: string, name: string): Promise<void> {
  const list = await listAliases();
  const alias = list.find((a) => a.id === id);
  if (!alias) throw new Error('Alias not found');
  alias.name = name.trim() || alias.name;
  await saveAliases(list);
}

export async function updateAlias(id: string, patch: { name?: string; emoji?: string }): Promise<AliasInfo> {
  const list = await listAliases();
  const alias = list.find((a) => a.id === id);
  if (!alias) throw new Error('Alias not found');
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error('Give the alias a name');
    if (name.length > 40) throw new Error('Keep the name under 40 characters');
    alias.name = name;
  }
  if (patch.emoji !== undefined) {
    if (!isSingleEmoji(patch.emoji)) throw new Error('Pick a single emoji');
    alias.emoji = patch.emoji.trim();
  }
  await saveAliases(list);
  return alias;
}

function defaultName(kind: AliasKind): string {
  switch (kind) {
    case 'trading':
      return 'Trading Alias';
    case 'collecting':
      return 'Collecting Alias';
    case 'everyday':
      return 'Everyday Alias';
    default:
      return 'Fresh Alias';
  }
}

export async function aliasBalanceLamports(id: string): Promise<number> {
  const alias = await getAlias(id);
  if (!alias) throw new Error('Alias not found');
  const connection = await getConnection();
  const { PublicKey } = await import('@solana/web3.js');
  return connection.getBalance(new PublicKey(alias.address));
}

export async function aliasKeypairById(id: string) {
  const alias = await getAlias(id);
  if (!alias) throw new Error('Alias not found');
  return deriveAliasKeypair(alias.index);
}
