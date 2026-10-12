// Builds a valid circuit input for a fresh Privacy Cash deposit (dummy inputs,
// so no Merkle membership is needed), mirroring privacycash/dist/deposit.js,
// then proves it in Node to confirm the input is valid and to time it.
import { Keypair, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { WasmFactory } from '@lightprotocol/hasher.rs';
import { writeFileSync } from 'node:fs';
import { Keypair as UtxoKeypair } from '../node_modules/privacycash/dist/models/keypair.js';
import { Utxo } from '../node_modules/privacycash/dist/models/utxo.js';
import { EncryptionService } from '../node_modules/privacycash/dist/utils/encryption.js';
import { FEE_RECIPIENT, FIELD_SIZE, MERKLE_TREE_DEPTH } from '../node_modules/privacycash/dist/utils/constants.js';
import { getExtDataHash } from '../node_modules/privacycash/dist/utils/utils.js';
import { prove } from '../node_modules/privacycash/dist/utils/prover.js';

const out = process.argv[2];
const lightWasm = await WasmFactory.getInstance();
const enc = new EncryptionService();
enc.deriveEncryptionKeyFromWallet(Keypair.generate());
const utxoKeypair = new UtxoKeypair(enc.getUtxoPrivateKeyV2(), lightWasm);
const amount = 20_000_000;
const inputs = [new Utxo({ lightWasm, keypair: utxoKeypair }), new Utxo({ lightWasm, keypair: utxoKeypair })];
const outputs = [
  new Utxo({ lightWasm, amount: String(amount), keypair: utxoKeypair, index: 0 }),
  new Utxo({ lightWasm, amount: '0', keypair: utxoKeypair, index: 1 }),
];
const publicAmount = new BN(amount).add(FIELD_SIZE).mod(FIELD_SIZE);
const extData = {
  recipient: new PublicKey(FEE_RECIPIENT).toString(),
  extAmount: new BN(amount),
  encryptedOutput1: enc.encryptUtxo(outputs[0]),
  encryptedOutput2: enc.encryptUtxo(outputs[1]),
  fee: new BN(0),
  feeRecipient: FEE_RECIPIENT,
  mintAddress: inputs[0].mintAddress,
};
const input = {
  root: '0',
  inputNullifier: await Promise.all(inputs.map((x) => x.getNullifier())),
  outputCommitment: await Promise.all(outputs.map((x) => x.getCommitment())),
  publicAmount: publicAmount.toString(),
  extDataHash: getExtDataHash(extData),
  inAmount: inputs.map((x) => x.amount.toString(10)),
  inPrivateKey: inputs.map((x) => x.keypair.privkey),
  inBlinding: inputs.map((x) => x.blinding.toString(10)),
  inPathIndices: [0, 0],
  inPathElements: inputs.map(() => new Array(MERKLE_TREE_DEPTH).fill('0')),
  outAmount: outputs.map((x) => x.amount.toString(10)),
  outBlinding: outputs.map((x) => x.blinding.toString(10)),
  outPubkey: outputs.map((x) => x.keypair.pubkey),
  mintAddress: inputs[0].mintAddress,
};
// Normalise every value to a decimal string (BN, bigint, Buffer/Uint8Array) so
// the browser receives exactly what snarkjs would see.
function norm(v) {
  if (Array.isArray(v)) return v.map(norm);
  if (typeof v === 'bigint') return v.toString();
  if (BN.isBN(v)) return v.toString(10);
  if (v instanceof Uint8Array) return new BN(Buffer.from(v)).toString(10);
  if (v && typeof v === 'object') throw new Error('unexpected object in input: ' + JSON.stringify(v).slice(0, 80));
  return String(v);
}
const normalised = Object.fromEntries(Object.entries(input).map(([k, v]) => [k, norm(v)]));
for (const [k, v] of Object.entries(input)) {
  const t = Array.isArray(v) ? `array of ${v[0]?.constructor?.name ?? typeof v[0]}` : v?.constructor?.name ?? typeof v;
  console.log(`  ${k}: ${t}`);
}
writeFileSync(out, JSON.stringify(normalised));
const t0 = Date.now();
const { publicSignals } = await prove(normalised, new URL('../node_modules/privacycash/circuit2/transaction2', import.meta.url).pathname);
console.log(`node proof OK in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${publicSignals.length} public signals`);
process.exit(0);
