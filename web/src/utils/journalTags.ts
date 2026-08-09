const journalTagPattern = /#([\p{L}\p{N}_]+)/gu;
const pureTagPattern = /^#[\p{L}\p{N}_]+$/u;

export interface AppendJournalTagsResult {
  contentText: string;
  addedTags: string[];
}

export function appendJournalTags(
  contentText: string,
  suggestedTags: readonly string[],
): AppendJournalTagsResult {
  const existingTags = new Set(
    [...contentText.matchAll(journalTagPattern)].map(match => match[1]!),
  );
  const addedTags = suggestedTags.filter((tag) => {
    if (existingTags.has(tag)) return false;
    existingTags.add(tag);
    return true;
  });

  if (addedTags.length === 0) return { contentText, addedTags };

  const tagLine = addedTags.map(tag => `#${tag}`).join(' ');
  const lines = contentText.split('\n');
  const lastNonEmptyLineIndex = lines.findLastIndex(line => line.trim() !== '');
  const lastNonEmptyLine = lines[lastNonEmptyLineIndex]?.trim() ?? '';
  const hasTrailingTagLine = lastNonEmptyLine !== ''
    && lastNonEmptyLine.split(/\s+/).every(token => pureTagPattern.test(token));

  if (hasTrailingTagLine) {
    lines[lastNonEmptyLineIndex] = `${lines[lastNonEmptyLineIndex]!.trimEnd()} ${tagLine}`;
    return { contentText: lines.join('\n'), addedTags };
  }

  const separator = contentText === '' || contentText.endsWith('\n\n')
    ? ''
    : contentText.endsWith('\n') ? '\n' : '\n\n';
  return {
    contentText: `${contentText}${separator}${tagLine}`,
    addedTags,
  };
}
