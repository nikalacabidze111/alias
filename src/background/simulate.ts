// Decode and simulate a transaction before signing, and report spend/receive effects.
// Fails closed: if effects cannot be established, the approval screen says so and
// the default action is Reject.
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  type AddressLookupTableAccount,
  type SimulatedTransactionAccountInfo,
} from '@solana/web3.js';
import type { SimulatedEffect, SimulationResult } from '../shared/messages';
import { getConnection } from './settings';

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const KNOWN_MINTS: Record<string, { symbol: string; decimals: number }> = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: { symbol: 'USDC', decimals: 6 },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: { symbol: 'USDT', decimals: 6 },
  So11111111111111111111111111111111111111112: { symbol: 'wSOL', decimals: 9 },
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: { symbol: 'JUP', decimals: 6 },
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: { symbol: 'BONK', decimals: 5 },
};

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

interface TokenAccountState {
  mint: string;
  owner: string;
  amount: bigint;
}

function parseTokenAccount(data: Uint8Array): TokenAccountState | null {
  if (data.length < 72) return null;
  const mint = new PublicKey(data.slice(0, 32)).toBase58();
  const owner = new PublicKey(data.slice(32, 64)).toBase58();
  let amount = 0n;
  for (let i = 7; i >= 0; i--) amount = (amount << 8n) | BigInt(data[64 + i]);
  return { mint, owner, amount };
}

function uiAmount(delta: bigint, decimals: number): string {
  const negative = delta < 0n;
  const abs = negative ? -delta : delta;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = (abs % base).toString().padStart(decimals, '0').replace(/0+$/, '');
  const s = frac ? `${whole}.${frac}` : `${whole}`;
  return `${negative ? '-' : '+'}${s}`;
}

export async function simulateForAlias(txBase64: string, aliasAddress: string): Promise<SimulationResult> {
  try {
    const connection = await getConnection();
    const tx = VersionedTransaction.deserialize(fromB64(txBase64));

    // Resolve address lookup tables so we see the full account list.
    const lookups: AddressLookupTableAccount[] = [];
    for (const lookup of tx.message.addressTableLookups ?? []) {
      const res = await connection.getAddressLookupTable(lookup.accountKey);
      if (!res.value) {
        return {
          ok: false,
          effects: [],
          error: 'Could not resolve an address lookup table used by this transaction',
          writableUnknown: true,
        };
      }
      lookups.push(res.value);
    }
    const accountKeys = tx.message.getAccountKeys({ addressLookupTableAccounts: lookups });
    const allKeys: PublicKey[] = [];
    for (let i = 0; i < accountKeys.length; i++) allKeys.push(accountKeys.get(i)!);

    const writable = allKeys.filter((_, i) => tx.message.isAccountWritable(i));
    // The RPC allows a limited accounts list; keep the most relevant if too many.
    const watchSet = writable.slice(0, 30);
    const watch = watchSet.map((k) => k.toBase58());

    // Pre-state.
    const preInfos = await connection.getMultipleAccountsInfo(watchSet, 'confirmed');

    // Simulate with post-state for the same accounts.
    const sim = await connection.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
      commitment: 'confirmed',
      accounts: { addresses: watch, encoding: 'base64' },
    });

    if (sim.value.err) {
      return {
        ok: false,
        effects: [],
        error: `Simulation failed: ${JSON.stringify(sim.value.err)}`,
        logsTail: (sim.value.logs ?? []).slice(-6),
        writableUnknown: true,
      };
    }

    const postAccounts = (sim.value.accounts ?? []) as (SimulatedTransactionAccountInfo | null)[];
    const effects: SimulatedEffect[] = [];
    let truncated = writable.length > watchSet.length;

    // SOL delta for the alias itself.
    const aliasIdx = watch.indexOf(aliasAddress);
    if (aliasIdx >= 0) {
      const pre = preInfos[aliasIdx]?.lamports ?? 0;
      const post = postAccounts[aliasIdx]?.lamports ?? 0;
      const delta = BigInt(post) - BigInt(pre);
      if (delta !== 0n) {
        effects.push({ kind: 'sol', delta: delta.toString(), uiDelta: `${uiAmount(delta, 9)} SOL` });
      }
    } else if (allKeys.some((k) => k.toBase58() === aliasAddress)) {
      // The alias is in the transaction but we could not watch it.
      truncated = true;
    }

    // Token deltas for accounts owned by the alias.
    const mintDecimals = new Map<string, number>();
    for (let i = 0; i < watchSet.length; i++) {
      const preInfo = preInfos[i];
      const postInfo = postAccounts[i];
      const ownerProgram = postInfo?.owner ?? preInfo?.owner?.toBase58();
      if (ownerProgram !== TOKEN_PROGRAM && ownerProgram !== TOKEN_2022_PROGRAM) continue;

      const preState = preInfo ? parseTokenAccount(new Uint8Array(preInfo.data)) : null;
      const postData = postInfo?.data?.[0] ? fromB64(postInfo.data[0]) : null;
      const postState = postData ? parseTokenAccount(postData) : null;
      const owner = postState?.owner ?? preState?.owner;
      if (owner !== aliasAddress) continue;
      const mint = postState?.mint ?? preState?.mint;
      if (!mint) continue;

      const delta = (postState?.amount ?? 0n) - (preState?.amount ?? 0n);
      if (delta === 0n) continue;

      let decimals: number | undefined = KNOWN_MINTS[mint]?.decimals;
      if (decimals === undefined) {
        if (!mintDecimals.has(mint)) {
          try {
            const supply = await connection.getTokenSupply(new PublicKey(mint));
            mintDecimals.set(mint, supply.value.decimals);
          } catch {
            mintDecimals.set(mint, -1);
          }
        }
        const d = mintDecimals.get(mint)!;
        decimals = d >= 0 ? d : undefined;
      }
      const symbol = KNOWN_MINTS[mint]?.symbol;
      effects.push({
        kind: 'token',
        mint,
        symbol,
        decimals,
        delta: delta.toString(),
        uiDelta:
          decimals !== undefined
            ? `${uiAmount(delta, decimals)} ${symbol ?? mint.slice(0, 4) + '…'}`
            : `${delta > 0n ? '+' : ''}${delta} base units of ${mint.slice(0, 4)}…`,
      });
    }

    // Fee estimate.
    let feeLamports: number | undefined;
    try {
      const fee = await connection.getFeeForMessage(tx.message, 'confirmed');
      feeLamports = fee.value ?? undefined;
    } catch {
      feeLamports = undefined;
    }

    return {
      ok: true,
      effects,
      feeLamports,
      logsTail: (sim.value.logs ?? []).slice(-4),
      writableUnknown: truncated,
    };
  } catch (e) {
    return {
      ok: false,
      effects: [],
      error: e instanceof Error ? e.message : 'Simulation did not complete',
      writableUnknown: true,
    };
  }
}
