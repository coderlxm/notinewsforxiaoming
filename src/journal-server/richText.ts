import { generateText } from '@tiptap/core';
import { generateHTML } from '@tiptap/html/server';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import type { JournalRichDocument, JournalRichNode } from '../shared/journalProtocol.js';
import { createJournalRichTextExtensions } from '../shared/journalRichText.js';

const serverExtensions = createJournalRichTextExtensions();

export function extractContentText(document: JournalRichDocument): string {
  return generateText(document as unknown as Parameters<typeof generateText>[0], serverExtensions);
}

export function collectInlineAssetIds(document: JournalRichDocument): number[] {
  const ids: number[] = [];
  const visit = (node: JournalRichNode): void => {
    if (node.type === 'image') {
      const attrs = node.attrs ?? {};
      const value = attrs['data-asset-id'];
      if (value !== undefined && value !== null) {
        const numeric = Number(value);
        if (Number.isInteger(numeric) && numeric > 0) ids.push(numeric);
      }
    }
    if (node.content) {
      for (const child of node.content) visit(child);
    }
  };
  visit(document);
  return ids;
}

const allowedLinkSchemes = new Set(['http:', 'https:', 'mailto:']);

export function assertRichDocument(document: JournalRichDocument, options: { allowImages: boolean }): void {
  if (!options.allowImages && collectInlineAssetIds(document).length > 0) {
    throw new Error('An article cannot contain images before its first save.');
  }
  const visit = (node: JournalRichNode): void => {
    if (Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type === 'link') {
          const href = mark.attrs?.href;
          if (typeof href !== 'string') {
            throw new Error('Link marks must contain a href attribute.');
          }
          let url: URL;
          try {
            url = new URL(href);
          } catch {
            throw new Error(`Link href ${href} is not a valid URL.`);
          }
          if (!allowedLinkSchemes.has(url.protocol)) {
            throw new Error(`Link href ${href} uses an unsupported protocol.`);
          }
        }
      }
    }
    if (node.type === 'image') {
      const attrs = node.attrs ?? {};
      const src = attrs.src;
      if (typeof src !== 'string' || !/^\/media\/\d+$/.test(src)) {
        throw new Error('Image src must point to /media/:assetId.');
      }
      const value = attrs['data-asset-id'];
      const numeric = Number(value);
      if (!Number.isInteger(numeric) || numeric <= 0) {
        throw new Error('Image nodes must reference an inline asset id.');
      }
      if (src !== `/media/${numeric}`) {
        throw new Error('Image src must match its inline asset id.');
      }
    }
    if (node.content) {
      for (const child of node.content) visit(child);
    }
  };
  visit(document);
}

export function generateArticleHtml(document: JournalRichDocument, publicBaseUrl: string): string {
  const raw = generateHTML(document as unknown as Parameters<typeof generateHTML>[0], serverExtensions);
  const $ = load(raw);
  $('img[src^="/media/"]').each((_, element) => {
    const src = $(element).attr('src') ?? '';
    $(element).attr('src', `${publicBaseUrl}${src}`);
  });
  return sanitizeHtml($.html(), {
    allowedTags: [
      'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'strong', 'em', 's', 'code', 'pre', 'blockquote',
      'ul', 'ol', 'li', 'a', 'img',
    ],
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      img: ['src', 'alt', 'data-asset-id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, rel: 'noopener noreferrer', target: '_blank' },
      }),
    },
  });
}
