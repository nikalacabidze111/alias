import { LAMPORTS_PER_SOL } from './constants';

export function lamportsToSol(lamports: number | bigint): string {
  const n = Number(lamports) / LAMPORTS_PER_SOL;
  if (!isFinite(n)) return '0';
  // Up to 9 decimals, trimmed.
  const s = n.toFixed(9).replace(/0+$/, '').replace(/\.$/, '');
  return s === '' || s === '-0' ? '0' : s;
}

export function solToLamports(sol: string | number): number {
  const n = typeof sol === 'string' ? Number(sol) : sol;
  if (!isFinite(n) || n < 0) return NaN;
  return Math.round(n * LAMPORTS_PER_SOL);
}

export function shortAddress(address: string, head = 4, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

export function uid(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// "today at 22:40" / "Tue 13 Oct at 09:15" for scheduled payouts.
export function formatWhen(ts: number): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return `today at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} at ${time}`;
}
