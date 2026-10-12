// Operation journal for private funding/return.
// Entries are written BEFORE submission and encrypted at rest with a key
// derived from the vault seed. Unknown status stays unknown until a
// confirmation is independently verified on chain.
import type { OperationRecord } from '../shared/messages';
import { decryptJson, deriveStorageKey, encryptJson, isUnlocked } from './vault';

const JOURNAL_KEY = 'journal.v1';

interface JournalFile {
  entries: string[]; // each entry is an encrypted OperationRecord
}

async function journalKey() {
  return deriveStorageKey('operation-journal');
}

async function readAll(): Promise<OperationRecord[]> {
  if (!(await isUnlocked())) return [];
  const stored = await chrome.storage.local.get(JOURNAL_KEY);
  const file = (stored[JOURNAL_KEY] as JournalFile | undefined) ?? { entries: [] };
  const key = await journalKey();
  const records: OperationRecord[] = [];
  for (const entry of file.entries) {
    try {
      records.push(await decryptJson<OperationRecord>(key, entry));
    } catch {
      // An entry we cannot decrypt is kept on disk but not shown.
    }
  }
  return records.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listOperations(): Promise<OperationRecord[]> {
  return readAll();
}

export async function getOperation(id: string): Promise<OperationRecord | undefined> {
  return (await readAll()).find((r) => r.id === id);
}

export async function putOperation(record: OperationRecord): Promise<void> {
  if (!(await isUnlocked())) throw new Error('Vault is locked');
  const key = await journalKey();
  const all = await readAll();
  const next = all.filter((r) => r.id !== record.id);
  next.push({ ...record, updatedAt: Date.now() });
  const entries: string[] = [];
  for (const r of next) entries.push(await encryptJson(key, r));
  await chrome.storage.local.set({ [JOURNAL_KEY]: { entries } satisfies JournalFile });
}

export function hasUncertainOperations(records: OperationRecord[]): boolean {
  return records.some((r) => !['done', 'failed'].includes(r.step));
}
