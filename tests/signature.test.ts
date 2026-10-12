// External-wallet signature verification: the signed bytes a wallet returns
// are only accepted when the message is byte-identical to what Alias built
// and the fee payer's ed25519 signature verifies.
import { describe, expect, it, beforeEach } from 'vitest';
import { installChromeMock } from './chrome-mock';
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import nacl from 'tweetnacl';

beforeEach(() => {
  installChromeMock();
});

const verifyFn = (m: Uint8Array, s: Uint8Array, p: Uint8Array) => nacl.sign.detached.verify(m, s, p);

function buildTx(payer: PublicKey, to: PublicKey, lamports: number): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: '11111111111111111111111111111111',
    instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: to, lamports })],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

describe('verifyExternalSignature', () => {
  it('accepts a correctly signed, unmodified transaction', async () => {
    const { verifyExternalSignature } = await import('../src/ops/privacy');
    const main = Keypair.generate();
    const aliasPk = Keypair.generate().publicKey;
    const unsigned = buildTx(main.publicKey, aliasPk, 1000);
    const signed = buildTx(main.publicKey, aliasPk, 1000);
    signed.sign([main]);

    const result = verifyExternalSignature(unsigned, signed.serialize(), main.publicKey, verifyFn);
    expect(result.signatures[0]).toEqual(signed.signatures[0]);
  });

  it('rejects a transaction the wallet swapped out (different message)', async () => {
    const { verifyExternalSignature } = await import('../src/ops/privacy');
    const main = Keypair.generate();
    const aliasPk = Keypair.generate().publicKey;
    const attacker = Keypair.generate().publicKey;
    const unsigned = buildTx(main.publicKey, aliasPk, 1000);
    const swapped = buildTx(main.publicKey, attacker, 999_000_000); // different recipient and amount
    swapped.sign([main]);

    expect(() => verifyExternalSignature(unsigned, swapped.serialize(), main.publicKey, verifyFn)).toThrow(
      /different transaction/,
    );
  });

  it('rejects a signature from the wrong signer', async () => {
    const { verifyExternalSignature } = await import('../src/ops/privacy');
    const main = Keypair.generate();
    const other = Keypair.generate();
    const aliasPk = Keypair.generate().publicKey;
    // Same message shape but fee payer is someone else entirely.
    const unsigned = buildTx(other.publicKey, aliasPk, 1000);
    const signed = buildTx(other.publicKey, aliasPk, 1000);
    signed.sign([other]);

    expect(() => verifyExternalSignature(unsigned, signed.serialize(), main.publicKey, verifyFn)).toThrow(
      /not from the selected main wallet/,
    );
  });

  it('rejects an invalid signature over the right message', async () => {
    const { verifyExternalSignature } = await import('../src/ops/privacy');
    const main = Keypair.generate();
    const aliasPk = Keypair.generate().publicKey;
    const unsigned = buildTx(main.publicKey, aliasPk, 1000);
    const forged = buildTx(main.publicKey, aliasPk, 1000);
    forged.addSignature(main.publicKey, new Uint8Array(64)); // zeroed signature

    expect(() => verifyExternalSignature(unsigned, forged.serialize(), main.publicKey, verifyFn)).toThrow(
      /did not verify/,
    );
  });
});
