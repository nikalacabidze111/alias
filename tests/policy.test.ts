// Signing policy: origin isolation, wrong-account rejection, approval
// requirement per request, and mainnet consent for private operations.
import { beforeEach, describe, expect, it } from 'vitest';
import { installChromeMock, type ChromeMock } from './chrome-mock';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';

let chrome: ChromeMock;
beforeEach(() => {
  chrome = installChromeMock();
});

function bytesToB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function txFor(payer: PublicKey): string {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: '11111111111111111111111111111111',
    instructions: [
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: Keypair.generate().publicKey, lamports: 1 }),
    ],
  }).compileToV0Message();
  return bytesToB64(new VersionedTransaction(message).serialize());
}

async function setup() {
  const vault = await import('../src/background/vault');
  const aliases = await import('../src/background/aliases');
  const origins = await import('../src/background/origins');
  const settings = await import('../src/background/settings');
  const bg = await import('../src/background/index');
  const approvals = await import('../src/background/approvals');
  await vault.createVault('correct horse battery');
  const alias = await aliases.createAlias('Trading', 'trading');
  return { vault, aliases, origins, settings, bg, approvals, alias };
}

// Find the approval window that askUser opened and resolve it like the popup would.
function autoResolve(approvals: typeof import('../src/background/approvals'), outcome: unknown, afterMs = 25) {
  setTimeout(() => {
    const win = chrome.windows._windows.at(-1);
    const match = win && /#\/approve\/(.+)$/.exec(win.url);
    if (match) approvals.resolveApproval(match[1], outcome);
  }, afterMs);
}

describe('dapp signing policy', () => {
  it('rejects signing for an origin that was never connected', async () => {
    const { bg, alias } = await setup();
    await expect(
      bg.handleDapp('https://never-connected.app', 1, {
        id: 'r1',
        method: 'signTransaction',
        params: { transaction: txFor(new PublicKey(alias.address)) },
      }),
    ).rejects.toThrow(/not connected/i);
  });

  it('keeps grants per exact origin — a grant for jup.ag gives nothing to a lookalike', async () => {
    const { bg, origins, settings, alias } = await setup();
    const s = await settings.getSettings();
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });

    // The granted origin can silently reconnect.
    const res = (await bg.handleDapp('https://jup.ag', 1, {
      id: 'r1',
      method: 'connect',
      params: { silent: true },
    })) as { address: string };
    expect(res.address).toBe(alias.address);

    // The lookalike cannot.
    await expect(
      bg.handleDapp('https://jup.ag.evil.com', 2, { id: 'r2', method: 'connect', params: { silent: true } }),
    ).rejects.toThrow(/not connected/i);
    await expect(
      bg.handleDapp('https://jup.ag.evil.com', 2, {
        id: 'r3',
        method: 'signTransaction',
        params: { transaction: txFor(new PublicKey(alias.address)) },
      }),
    ).rejects.toThrow(/not connected/i);
  });

  it('rejects a transaction whose required signer is not the connected alias', async () => {
    const { bg, origins, settings, alias } = await setup();
    const s = await settings.getSettings();
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });
    const stranger = Keypair.generate().publicKey;
    await expect(
      bg.handleDapp('https://jup.ag', 1, {
        id: 'r1',
        method: 'signTransaction',
        params: { transaction: txFor(stranger) },
      }),
    ).rejects.toThrow(/not for the connected alias/i);
  });

  it('rejects a request that names a different account than the approved alias', async () => {
    const { bg, origins, settings, alias } = await setup();
    const s = await settings.getSettings();
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });
    await expect(
      bg.handleDapp('https://jup.ag', 1, {
        id: 'r1',
        method: 'signTransaction',
        params: { transaction: txFor(new PublicKey(alias.address)), address: Keypair.generate().publicKey.toBase58() },
      }),
    ).rejects.toThrow(/not approved/i);
  });

  it('a declined approval means no signature', async () => {
    const { bg, origins, settings, approvals, alias } = await setup();
    const s = await settings.getSettings();
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });
    autoResolve(approvals, { approved: false });
    await expect(
      bg.handleDapp('https://jup.ag', 1, {
        id: 'r1',
        method: 'signTransaction',
        params: { transaction: txFor(new PublicKey(alias.address)) },
      }),
    ).rejects.toThrow(/declined/i);
  });

  it('closing the approval window without deciding counts as a rejection', async () => {
    const { bg, origins, settings, alias } = await setup();
    const s = await settings.getSettings();
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });
    setTimeout(() => {
      const win = chrome.windows._windows.at(-1);
      if (win) void chrome.windows.remove(win.id);
    }, 25);
    await expect(
      bg.handleDapp('https://jup.ag', 1, {
        id: 'r1',
        method: 'signMessage',
        params: { message: bytesToB64(new TextEncoder().encode('hello')) },
      }),
    ).rejects.toThrow(/declined/i);
  });

  it('an approved devnet signature works end to end and verifies', async () => {
    const { bg, origins, settings, approvals, aliases, alias } = await setup();
    const s = await settings.getSettings();
    expect(s.network).toBe('devnet'); // default network is devnet until explicit consent
    await origins.saveGrant({ origin: 'https://jup.ag', aliasId: alias.id, network: s.network, grantedAt: 1 });
    autoResolve(approvals, { approved: true });
    const result = (await bg.handleDapp('https://jup.ag', 1, {
      id: 'r1',
      method: 'signMessage',
      params: { message: bytesToB64(new TextEncoder().encode('hello')) },
    })) as { signature: string; publicKey: string };
    expect(result.publicKey).toBe(alias.address);

    const nacl = (await import('tweetnacl')).default;
    const kp = await aliases.aliasKeypairById(alias.id);
    const ok = nacl.sign.detached.verify(
      new TextEncoder().encode('hello'),
      Buffer.from(result.signature, 'base64'),
      kp.publicKey.toBytes(),
    );
    expect(ok).toBe(true);
  });
});

describe('private operations: consent and limits', () => {
  it('refuses to start a fund operation before mainnet consent', async () => {
    const { bg, alias } = await setup();
    await expect(bg.startOperation('fund', alias.id, 10_000_000)).rejects.toThrow(/mainnet/i);
  });

  it('enforces the per-operation limit after consent', async () => {
    const { bg, settings, alias } = await setup();
    await settings.updateSettings({ mainnetEnabled: true, network: 'mainnet-beta' });
    await expect(bg.startOperation('fund', alias.id, 10e9)).rejects.toThrow(/limit/i);
    // Within the limit: the operation record is journaled and a window opens.
    const record = await bg.startOperation('fund', alias.id, 20_000_000);
    expect(record.step).toBe('created');
    const journal = await import('../src/background/journal');
    expect((await journal.getOperation(record.id))?.id).toBe(record.id);
    expect(chrome.windows._windows.some((w) => w.url.includes(`ops/ops.html#${record.id}`))).toBe(true);
  });

  it('only accepts the offered payout delays and journals the choice', async () => {
    const { bg, settings, alias } = await setup();
    await settings.updateSettings({ mainnetEnabled: true, network: 'mainnet-beta' });
    await expect(bg.startOperation('fund', alias.id, 10_000_000, undefined, 30)).rejects.toThrow(/when the pool/i);
    await expect(bg.startOperation('fund', alias.id, 10_000_000, undefined, -1)).rejects.toThrow(/when the pool/i);
    const later = await bg.startOperation('fund', alias.id, 10_000_000, undefined, 1440);
    const journal = await import('../src/background/journal');
    const stored = await journal.getOperation(later.id);
    expect(stored?.delayMinutes).toBe(1440);
    // payAfter is only set once the deposit confirms, never at creation.
    expect(stored?.payAfter).toBeUndefined();
    const now = await bg.startOperation('fund', alias.id, 10_000_000);
    expect((await journal.getOperation(now.id))?.delayMinutes).toBe(0);
  });

  it('reopening an operation can ask for an immediate payout explicitly', async () => {
    const { bg } = await setup();
    await bg.openOperationWindow('abc123', true);
    await bg.openOperationWindow('abc123');
    const urls = chrome.windows._windows.map((w) => w.url);
    expect(urls.some((u) => u.endsWith('ops/ops.html#abc123&now=1'))).toBe(true);
    expect(urls.some((u) => u.endsWith('ops/ops.html#abc123'))).toBe(true);
  });

  it('a return operation needs a valid destination', async () => {
    const { bg, settings, alias } = await setup();
    await settings.updateSettings({ mainnetEnabled: true, network: 'mainnet-beta' });
    await expect(bg.startOperation('return', alias.id, 10_000_000)).rejects.toThrow(/destination/i);
    await expect(bg.startOperation('return', alias.id, 10_000_000, 'not-an-address')).rejects.toThrow();
  });

  it('settings guard: mainnet network without the consent flag is refused', async () => {
    const { settings } = await setup();
    await expect(settings.updateSettings({ network: 'mainnet-beta' })).rejects.toThrow(/Enable mainnet/i);
  });
});
