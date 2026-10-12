// MAIN-world script: registers Alias as a real Wallet Standard wallet so
// Solana apps discover it in their own wallet pickers. All requests go to the
// extension through the relay; no keys ever exist in this world.
import { registerWallet } from '@wallet-standard/wallet';
import bs58 from 'bs58';
import { markSvg } from '../shared/brand';
import {
  CHANNEL_FROM_RELAY,
  CHANNEL_TO_RELAY,
  type PageEvent,
  type PageRequest,
  type PageResponse,
} from '../shared/messages';

type Listener = (...args: unknown[]) => void;

const pendingById = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const companionTaskListeners = new Set<Listener>();

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return;
  const data = event.data as PageResponse | PageEvent | undefined;
  if (!data || data.channel !== CHANNEL_FROM_RELAY) return;
  if ('event' in data) {
    if (data.event === 'companionTask') {
      for (const l of companionTaskListeners) l(data.data);
    }
    return;
  }
  const waiting = pendingById.get(data.id);
  if (!waiting) return;
  pendingById.delete(data.id);
  if (data.ok) waiting.resolve(data.result);
  else waiting.reject(Object.assign(new Error(data.error?.message ?? 'Request failed'), { code: data.error?.code }));
});

function request<T>(method: PageRequest['method'], params?: unknown): Promise<T> {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const message: PageRequest = { channel: CHANNEL_TO_RELAY, id, method, params };
  return new Promise<T>((resolve, reject) => {
    pendingById.set(id, { resolve: resolve as (v: unknown) => void, reject });
    window.postMessage(message, window.location.origin);
  });
}

// Companion pages use a tiny API instead of the wallet interface.
(window as unknown as { alias?: unknown }).alias = {
  companionReady: (opId: string) => request('companionReady', { opId }),
  companionWallet: (opId: string, address: string, walletName: string) =>
    request('companionWallet', { opId, address, walletName }),
  companionSigned: (opId: string, signedTxB64: string) => request('companionSigned', { opId, signedTxB64 }),
  companionError: (opId: string, task: string, message: string) =>
    request('companionError', { opId, task, message }),
  onCompanionTask: (listener: Listener) => {
    companionTaskListeners.add(listener);
    return () => companionTaskListeners.delete(listener);
  },
};

// ---------- Wallet Standard ----------
// The A-mask mark: what wallet pickers (Jupiter and others) show for Alias.
const ICON: `data:image/svg+xml;base64,${string}` = `data:image/svg+xml;base64,${btoa(markSvg(64))}`;

const CHAINS = ['solana:mainnet', 'solana:devnet'] as const;

interface AliasAccount {
  address: string;
  publicKey: Uint8Array;
  chains: readonly string[];
  features: readonly string[];
  label: string;
  icon: typeof ICON;
}

function makeAccount(address: string, network: string): AliasAccount {
  const chain = network === 'mainnet-beta' ? 'solana:mainnet' : 'solana:devnet';
  return {
    address,
    publicKey: bs58.decode(address),
    chains: [chain],
    features: ['solana:signTransaction', 'solana:signAndSendTransaction', 'solana:signMessage'],
    label: 'Alias',
    icon: ICON,
  };
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

class AliasWallet {
  readonly version = '1.0.0' as const;
  readonly name = 'Alias';
  readonly icon = ICON;
  readonly chains = CHAINS;
  #accounts: AliasAccount[] = [];
  #listeners = new Map<string, Set<Listener>>();

  get accounts() {
    return this.#accounts.slice();
  }

  get features() {
    return {
      'standard:connect': { version: '1.0.0', connect: this.#connect },
      'standard:disconnect': { version: '1.0.0', disconnect: this.#disconnect },
      'standard:events': { version: '1.0.0', on: this.#on },
      'solana:signTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signTransaction: this.#signTransaction,
      },
      'solana:signAndSendTransaction': {
        version: '1.0.0',
        supportedTransactionVersions: ['legacy', 0],
        signAndSendTransaction: this.#signAndSendTransaction,
      },
      'solana:signMessage': { version: '1.0.0', signMessage: this.#signMessage },
    };
  }

  #emit(event: string, ...args: unknown[]) {
    for (const l of this.#listeners.get(event) ?? []) l(...args);
  }

  #on = (event: string, listener: Listener): (() => void) => {
    const set = this.#listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.#listeners.set(event, set);
    return () => set.delete(listener);
  };

  #connect = async (input?: { silent?: boolean }) => {
    const result = await request<{ address: string; network: string }>('connect', { silent: input?.silent });
    this.#accounts = [makeAccount(result.address, result.network)];
    this.#emit('change', { accounts: this.accounts });
    return { accounts: this.accounts };
  };

  #disconnect = async () => {
    await request('disconnect');
    this.#accounts = [];
    this.#emit('change', { accounts: this.accounts });
  };

  #signTransaction = async (...inputs: { transaction: Uint8Array; account: { address: string } }[]) => {
    const outputs: { signedTransaction: Uint8Array }[] = [];
    for (const input of inputs) {
      const result = await request<{ signedTransaction: string }>('signTransaction', {
        transaction: bytesToB64(input.transaction),
        address: input.account?.address,
      });
      outputs.push({ signedTransaction: b64ToBytes(result.signedTransaction) });
    }
    return outputs;
  };

  #signAndSendTransaction = async (...inputs: { transaction: Uint8Array; account: { address: string } }[]) => {
    const outputs: { signature: Uint8Array }[] = [];
    for (const input of inputs) {
      const result = await request<{ signature: string }>('signAndSendTransaction', {
        transaction: bytesToB64(input.transaction),
        address: input.account?.address,
      });
      outputs.push({ signature: bs58.decode(result.signature) });
    }
    return outputs;
  };

  #signMessage = async (...inputs: { message: Uint8Array; account: { address: string } }[]) => {
    const outputs: { signedMessage: Uint8Array; signature: Uint8Array }[] = [];
    for (const input of inputs) {
      const result = await request<{ signature: string }>('signMessage', {
        message: bytesToB64(input.message),
        address: input.account?.address,
      });
      outputs.push({ signedMessage: input.message, signature: b64ToBytes(result.signature) });
    }
    return outputs;
  };
}

try {
  registerWallet(new AliasWallet() as never);
} catch (e) {
  console.warn('[alias] wallet registration failed', e);
}
