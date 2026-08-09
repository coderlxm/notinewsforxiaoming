const journalTagPattern = /#([\p{L}\p{N}_]+)/gu;

export function stripJournalTags(contentText: string, tags: readonly string[]): string {
  const journalTags = new Set(tags);
  return contentText
    .replace(journalTagPattern, (token, tag: string) => journalTags.has(tag) ? '' : token)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
