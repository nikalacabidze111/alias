// Alias emoji: defaults per kind, a curated picker set, and validation that
// a value is exactly one emoji (one grapheme with an emoji code point).
import type { AliasKind } from './constants';

export const KIND_EMOJI: Record<AliasKind, string> = {
  trading: '📈',
  collecting: '🖼️',
  everyday: '☕',
  fresh: '🌱',
};

export const EMOJI_CHOICES = [
  '📈', '🖼️', '☕', '🌱', '🦊', '🐋', '🦉', '🐙',
  '🐺', '🐸', '🐼', '🦁', '🦋', '🐝', '🌙', '⭐',
  '🔥', '💎', '🎯', '🎲', '🍀', '🚀', '👾', '🕶️',
];

function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((g) => g.segment);
  return [...s];
}

export function isSingleEmoji(value: string): boolean {
  const s = value.trim();
  if (!s || s.length > 16) return false;
  if (graphemes(s).length !== 1) return false;
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s);
}

export function emojiFor(alias: { kind?: AliasKind; emoji?: string }): string | null {
  if (alias.emoji && isSingleEmoji(alias.emoji)) return alias.emoji;
  return alias.kind ? KIND_EMOJI[alias.kind] : null;
}
