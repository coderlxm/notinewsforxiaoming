export const textPosterTemplates = [
  'editorial',
  'book',
  'swiss',
  'archive',
  'cinema',
  'notebook',
  'gazette',
  'monolith',
  'botanical',
  'manifesto',
  'blueprint',
  'poetry',
  'receipt',
  'horizon',
] as const;

export type TextPosterTemplate = typeof textPosterTemplates[number];

export function resolveTextPosterTemplate(key: string): TextPosterTemplate {
  let hash = 0;
  for (const character of key) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  }
  return textPosterTemplates[hash % textPosterTemplates.length]!;
}
