import type { JSONContent } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { generateUniqueIds, UniqueID } from '@tiptap/extension-unique-id';
import StarterKit from '@tiptap/starter-kit';

export const journalHeadingIdPattern = /^section-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export const journalImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-asset-id': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-asset-id'),
        renderHTML: (attributes) => {
          const value = attributes['data-asset-id'];
          return value == null ? {} : { 'data-asset-id': String(value) };
        },
      },
    };
  },
});

export function createJournalRichTextExtensions(options: { updateHeadingIds?: boolean } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      underline: false,
      link: {
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      },
    }),
    UniqueID.configure({
      attributeName: 'anchorId',
      types: ['heading'],
      generateID: () => `section-${crypto.randomUUID()}`,
      updateDocument: options.updateHeadingIds ?? true,
    }),
    journalImageExtension,
  ];
}

export function addJournalHeadingIds(document: JSONContent): JSONContent {
  return generateUniqueIds(
    document,
    createJournalRichTextExtensions({ updateHeadingIds: false }),
  );
}
