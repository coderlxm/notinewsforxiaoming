function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeUrl(url: string | null): string {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return '#';
  }
  return '#';
}

export interface AvUpdateMessageInput {
  targetName: string;
  targetType: 'star' | 'label';
  title: string;
  translatedTitle: string | null;
  pubDate: string | null;
  link: string | null;
}

export function formatAvUpdateMessage(input: AvUpdateMessageInput): string {
  const targetTypeLabel = input.targetType === 'label' ? '片商' : '演员';
  const translated = input.translatedTitle && input.translatedTitle.trim() ? input.translatedTitle.trim() : null;
  const hasTranslated = translated && translated !== input.title;
  const lines = [
    '<b>AV 新作更新</b>',
    '──────────────────',
    `${targetTypeLabel}：<b>${escapeHtml(input.targetName)}</b>`,
    `标题：${escapeHtml(input.title)}`,
  ];

  if (hasTranslated) {
    lines.push(`翻译：${escapeHtml(translated)}`);
  }
  if (input.pubDate) {
    lines.push(`最新更新日期：${escapeHtml(input.pubDate)}`);
  }

  const safeUrl = normalizeUrl(input.link);
  if (safeUrl !== '#') {
    lines.push(`链接：<a href="${escapeHtml(safeUrl)}">查看作品</a>`);
  }

  lines.push('──────────────────');
  lines.push('#AV更新 #JavBus');

  return lines.join('\n');
}
