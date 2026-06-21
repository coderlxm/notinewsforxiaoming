import { Marked, type RendererObject, type Tokens } from 'marked';
import { escapeHtml, escapeHtmlAttr } from './html.js';

function normalizeHttpUrl(href: string): string | null {
  if (!URL.canParse(href)) return null;
  const parsed = new URL(href);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  return parsed.toString();
}

const TELEGRAM_RENDERER: RendererObject<string, string> = {
  code({ text }: Tokens.Code): string {
    return `<pre>${escapeHtml(text)}</pre>\n`;
  },
  blockquote({ tokens }: Tokens.Blockquote): string {
    return `${this.parser.parse(tokens)}\n`;
  },
  html({ text }: Tokens.HTML | Tokens.Tag): string {
    return escapeHtml(text);
  },
  heading({ tokens }: Tokens.Heading): string {
    return `<b>${this.parser.parseInline(tokens)}</b>\n`;
  },
  hr(): string {
    return '\n';
  },
  list({ items, ordered, start }: Tokens.List): string {
    const firstNumber = typeof start === 'number' ? start : 1;
    const body = items.map((item, index) => {
      const marker = ordered ? `${firstNumber + index}. ` : '- ';
      const text = this.parser.parse(item.tokens).trimEnd().replace(/\n/g, '\n  ');
      return `${marker}${text}`;
    }).join('\n');
    return `${body}\n`;
  },
  listitem({ tokens }: Tokens.ListItem): string {
    return `${this.parser.parse(tokens)}\n`;
  },
  checkbox(): string {
    return '';
  },
  paragraph({ tokens }: Tokens.Paragraph): string {
    return `${this.parser.parseInline(tokens)}\n`;
  },
  table({ header, rows }: Tokens.Table): string {
    const cells = header.map((h) => this.parser.parseInline(h.tokens)).join(' | ');
    const body = rows.map((row) => row.map((cell) => this.parser.parseInline(cell.tokens)).join(' | ')).join('\n');
    return `${cells}\n${body}\n`;
  },
  tablerow(): string {
    return '';
  },
  tablecell(): string {
    return '';
  },
  strong({ tokens }: Tokens.Strong): string {
    return `<b>${this.parser.parseInline(tokens)}</b>`;
  },
  em({ tokens }: Tokens.Em): string {
    return `<i>${this.parser.parseInline(tokens)}</i>`;
  },
  codespan({ text }: Tokens.Codespan): string {
    return `<code>${escapeHtml(text)}</code>`;
  },
  br(): string {
    return '\n';
  },
  del({ tokens }: Tokens.Del): string {
    return `<s>${this.parser.parseInline(tokens)}</s>`;
  },
  link({ href, tokens }: Tokens.Link): string {
    const label = this.parser.parseInline(tokens);
    const url = normalizeHttpUrl(href);
    if (!url) return label;
    const safeUrl = escapeHtmlAttr(url);
    return `<a href="${safeUrl}">${label}</a>`;
  },
  image({ href, text }: Tokens.Image): string {
    const label = escapeHtml(text || href);
    const url = normalizeHttpUrl(href);
    if (!url) return label;
    const safeUrl = escapeHtmlAttr(url);
    return `<a href="${safeUrl}">${label}</a>`;
  },
  text(token: Tokens.Text | Tokens.Escape): string {
    if ('tokens' in token && token.tokens) return this.parser.parseInline(token.tokens);
    return escapeHtml(token.text);
  },
};

const marked = new Marked({ renderer: TELEGRAM_RENDERER });

export function renderMarkdownLikeAsHtml(input: string): string {
  return marked.parse(input, { async: false }) as string;
}
