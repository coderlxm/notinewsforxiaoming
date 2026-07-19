import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';

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

export function createJournalRichTextExtensions() {
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
    journalImageExtension,
  ];
}
