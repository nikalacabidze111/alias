// Pending approvals: dapp connection / transaction / message requests waiting
// for the user, each shown in a small extension window. Resolvers live in
// service-worker memory; the open approval window pings the worker to keep it
// alive while the user decides. If the worker still dies, the dapp request
// fails visibly and can simply be retried.
import type { ConnectApprovalRequest, MsgApprovalRequest, TxApprovalRequest } from '../shared/messages';
import { uid } from '../shared/format';

export type ApprovalPayload =
  | { kind: 'connect'; request: ConnectApprovalRequest }
  | { kind: 'tx'; request: TxApprovalRequest }
  | { kind: 'msg'; request: MsgApprovalRequest };

export interface ConnectOutcome {
  approved: boolean;
  aliasId?: string;
}

interface PendingEntry {
  payload: ApprovalPayload;
  resolve: (outcome: unknown) => void;
  windowId?: number;
}

const pending = new Map<string, PendingEntry>();

export function newRequestId(): string {
  return uid();
}

export function getApproval(requestId: string): ApprovalPayload | undefined {
  return pending.get(requestId)?.payload;
}

export async function askUser<T>(payload: ApprovalPayload): Promise<T> {
  const requestId =
    payload.kind === 'connect'
      ? payload.request.requestId
      : payload.kind === 'tx'
        ? payload.request.requestId
        : payload.request.requestId;

  const promise = new Promise<T>((resolve) => {
    pending.set(requestId, { payload, resolve: resolve as (o: unknown) => void });
  });

  const url = chrome.runtime.getURL(`popup/popup.html#/approve/${requestId}`);
  const win = await chrome.windows.create({
    url,
    type: 'popup',
    width: 376,
    height: 648,
    focused: true,
  });
  const entry = pending.get(requestId);
  if (entry) entry.windowId = win?.id;

  // If the user closes the window without deciding, treat it as a rejection.
  const onRemoved = (windowId: number) => {
    const e = pending.get(requestId);
    if (e && e.windowId === windowId) {
      pending.delete(requestId);
      chrome.windows.onRemoved.removeListener(onRemoved);
      e.resolve({ approved: false });
    }
  };
  chrome.windows.onRemoved.addListener(onRemoved);

  return promise;
}

export function resolveApproval(requestId: string, outcome: unknown): boolean {
  const entry = pending.get(requestId);
  if (!entry) return false;
  pending.delete(requestId);
  entry.resolve(outcome);
  if (entry.windowId !== undefined) {
    chrome.windows.remove(entry.windowId).catch(() => undefined);
  }
  return true;
}

// ---------- companion handoffs (external main wallet) ----------
// The ops page asks the companion tab (a normal web page where Phantom and
// other wallets live) either for a wallet choice or for a signature over an
// unsigned transaction we built. No secrets ever go to the companion.

interface CompanionTask {
  opId: string;
  task: 'pick-wallet' | 'sign' | 'status';
  txBase64?: string;
  text?: string;
  state?: 'working' | 'failed' | 'done';
}

interface CompanionPending {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

const companionPending = new Map<string, CompanionPending>();
const companionTabs = new Map<string, number>(); // opId -> tabId
const registrationWaiters = new Map<string, ((tabId: number) => void)[]>();
let deliverToTab: ((tabId: number, task: CompanionTask) => boolean) | null = null;

export function setCompanionDeliverer(fn: (tabId: number, task: CompanionTask) => boolean): void {
  deliverToTab = fn;
}

export function registerCompanionTab(opId: string, tabId: number): void {
  companionTabs.set(opId, tabId);
  for (const waiter of registrationWaiters.get(opId) ?? []) waiter(tabId);
  registrationWaiters.delete(opId);
}

export function companionTabFor(opId: string): number | undefined {
  return companionTabs.get(opId);
}

function waitForCompanionTab(opId: string, timeoutMs: number): Promise<number> {
  const existing = companionTabs.get(opId);
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise<number>((resolve, reject) => {
    const waiters = registrationWaiters.get(opId) ?? [];
    waiters.push(resolve);
    registrationWaiters.set(opId, waiters);
    setTimeout(
      () => reject(new Error('The funding page did not load. Check the funding page URL in Settings and try again.')),
      timeoutMs,
    );
  });
}

export async function askCompanion<T>(opId: string, task: CompanionTask['task'], txBase64?: string): Promise<T> {
  const tabId = await waitForCompanionTab(opId, 90_000);
  if (!deliverToTab) {
    return Promise.reject(new Error('The funding page is not open. Open it from the funding step and try again.'));
  }
  return new Promise<T>((resolve, reject) => {
    const key = `${opId}:${task}`;
    companionPending.set(key, { resolve: resolve as (v: unknown) => void, reject });
    const delivered = deliverToTab!(tabId, { opId, task, txBase64 });
    if (!delivered) {
      companionPending.delete(key);
      reject(new Error('Lost the connection to the funding page. Reload it and try again.'));
    }
    // A signature that takes longer than 10 minutes is treated as abandoned.
    setTimeout(() => {
      if (companionPending.has(key)) {
        companionPending.delete(key);
        reject(new Error('Timed out waiting for the main wallet. Try the step again.'));
      }
    }, 10 * 60 * 1000);
  });
}

// Best effort: show the operation's current step on the funding page.
export function notifyCompanion(opId: string, text: string, state: 'working' | 'failed' | 'done'): boolean {
  const tabId = companionTabs.get(opId);
  if (tabId === undefined || !deliverToTab) return false;
  return deliverToTab(tabId, { opId, task: 'status', text, state });
}

export function resolveCompanion(opId: string, task: CompanionTask['task'], ok: boolean, value: unknown): void {
  const key = `${opId}:${task}`;
  const entry = companionPending.get(key);
  if (!entry) return;
  companionPending.delete(key);
  if (ok) entry.resolve(value);
  else entry.reject(new Error(typeof value === 'string' ? value : 'The main wallet request failed'));
}
