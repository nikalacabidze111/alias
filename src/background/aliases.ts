// Alias records: public metadata in chrome.storage.local, keys derived from the vault seed.
import { Connection } from '@solana/web3.js';
import type { AliasInfo } from '../shared/messages';
import type { AliasKind } from '../shared/constants';
import { uid } from '../shared/format';
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

export async function createAlias(name: string, kind: AliasKind): Promise<AliasInfo> {
  if (!(await getSessionSeed())) throw new Error('Vault is locked');
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
