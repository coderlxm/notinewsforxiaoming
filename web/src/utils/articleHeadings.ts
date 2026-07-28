import type { JournalRichDocument, JournalRichNode } from '../types';

export interface ArticleHeading {
  id: string;
  level: 2 | 3;
  text: string;
}

function nodeText(node: JournalRichNode): string {
  if (node.text) return node.text;
  return node.content?.map(nodeText).join('') ?? '';
}

export function extractArticleHeadings(document: JournalRichDocument | null): ArticleHeading[] {
  if (!document) return [];
  return document.content.flatMap((node) => {
    if (node.type !== 'heading') return [];
    const level = node.attrs?.level;
    const id = node.attrs?.anchorId;
    const text = nodeText(node).trim();
    if ((level !== 2 && level !== 3) || typeof id !== 'string' || text === '') return [];
    return [{ id, level, text }];
  });
}
