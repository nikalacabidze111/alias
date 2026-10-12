import type { AliasKind } from './constants';
import { emojiFor } from './emoji';

// Brand mark and letter tiles, shared by the popup, operation window,
// funding page and the Wallet Standard icon. Pure strings, no DOM.

// The A-mask mark: a heavy A whose crossbar carries a mask cut-out.
const MARK_A =
  'M452,190 L572,190 L854,830 L724,830 L668,702 L356,702 L300,830 L170,830 Z ' +
  'M512,338 L568,478 L456,478 Z ' +
  'M306,560 C362,552 424,546 472,566 C492,574 502,580 512,580 C522,580 532,574 552,566 C600,546 662,552 718,560 ' +
  'C708,604 686,644 640,652 C598,660 560,632 512,632 C464,632 426,660 384,652 C338,644 316,604 306,560 Z';
const MARK_EYES = 'M388,592 C404,582 430,582 446,596 C430,610 404,610 388,592 Z M578,596 C594,582 620,582 636,592 C620,610 594,610 578,596 Z';

export const BRAND = { ink: '#1E1812', lilac: '#AE94F6', paper: '#F7F2E8' };

/** The mark on its lilac tile (default) or as a bare glyph. */
export function markSvg(size: number, opts: { tile?: boolean; ink?: string; bg?: string } = {}): string {
  const tile = opts.tile ?? true;
  const ink = opts.ink ?? BRAND.ink;
  const bg = opts.bg ?? BRAND.lilac;
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${
    tile ? `<rect width="1024" height="1024" rx="230" fill="${bg}"/>` : ''
  }<path fill-rule="evenodd" fill="${ink}" d="${MARK_A}"/><path fill="${ink}" d="${MARK_EYES}"/></svg>`;
}

/** First letter or digit of a name, uppercase ("jup.ag Alias" -> "J"). */
export function initialOf(name: string): string {
  const m = /[\p{L}\p{N}]/u.exec(name);
  return m ? m[0].toUpperCase() : 'A';
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Square letter tile for an alias. Four ink/lilac variants picked by the
 * alias's seed, so aliases are easy to tell apart without extra colors.
 * `onLilac` avoids a lilac tile sitting on the lilac alias card.
 */
export function aliasTile(
  alias: { name: string; avatarSeed: number; kind?: AliasKind; emoji?: string },
  size = 32,
  onLilac = false,
): string {
  const emoji = emojiFor(alias);
  if (emoji) {
    const radius = Math.round(size * 0.28);
    return `<span class="tile tile-emoji${onLilac ? ' on-lilac' : ''}" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${Math.round(size * 0.56)}px" aria-hidden="true">${escapeHtml(emoji)}</span>`;
  }
  let variant = Math.abs(alias.avatarSeed) % 4;
  if (onLilac && (variant === 0 || variant === 3)) variant = 1;
  const radius = Math.round(size * 0.28);
  const font = Math.round(size * 0.5);
  return `<span class="tile tile-${variant}" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${font}px" aria-hidden="true">${escapeHtml(initialOf(alias.name))}</span>`;
}

/** Neutral tile for a website, from its host name. Never fetches a favicon. */
export function siteTile(host: string, size = 36): string {
  const radius = Math.round(size * 0.28);
  return `<span class="tile tile-site" style="width:${size}px;height:${size}px;border-radius:${radius}px;font-size:${Math.round(size * 0.48)}px" aria-hidden="true">${escapeHtml(initialOf(host.replace(/^www\./, '')))}</span>`;
}

// Small-size mark (16-32 px): the A fills the tile with heavier strokes, and
// the mask becomes a simple slit so it survives at toolbar size.
export function smallMarkSvg(size: number, opts: { mask?: boolean } = {}): string {
  const mask = opts.mask ?? size >= 20;
  const a =
    'M12.9,3 L19.1,3 L29.4,29 L22.6,29 L20.9,24.4 L11.1,24.4 L9.4,29 L2.6,29 Z ' + // outer A + leg notch
    'M16,9.2 L18.6,16.4 L13.4,16.4 Z'; // counter
  const slit = mask
    ? ' M10.2,18.6 C12.6,18.1 14.3,18.6 16,19.6 C17.7,18.6 19.4,18.1 21.8,18.6 C21.3,21.1 19.7,22.1 18.1,21.8 C17.2,21.6 16.6,21.2 16,21.2 C15.4,21.2 14.8,21.6 13.9,21.8 C12.3,22.1 10.7,21.1 10.2,18.6 Z'
    : '';
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="7" fill="${BRAND.lilac}"/><path fill-rule="evenodd" fill="${BRAND.ink}" d="${a}${slit}"/></svg>`;
}
