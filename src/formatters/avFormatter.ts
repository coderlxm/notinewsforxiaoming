import { escapeHtml } from '../utils/html.js';
import type { AvTargetType } from '../services/avTargets.js';

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
  targetType: AvTargetType;
  title: string;
  translatedTitle: string | null;
  pubDate: string | null;
  link: string | null;
  // New premium fields
  code?: string | null;
  maker?: string | null;
  genres?: string[] | null;
  enhancedGenres?: string | null;
  bestMagnet?: { name: string; link: string; size: string; shareDate: string } | null;
}

export interface AvLabelSummaryMessageInput {
  targetName: string;
  targetType: AvTargetType;
  latestDate: string;
  totalNewCount: number;
  items: Array<{ title: string; link: string | null }>;
  remainingCount: number;
  targetLink: string | null;
}

export function formatAvUpdateMessage(input: AvUpdateMessageInput): string {
  const translated = input.translatedTitle && input.translatedTitle.trim()
    ? input.translatedTitle.trim()
    : null;
  const displayTitle = translated || input.title;

  let heading = '🌟 <b>关注女优新作更新</b>';
  let subjectLine = `👩 <b>演员</b>：${escapeHtml(input.targetName)}`;
  if (input.targetType === 'series') {
    heading = '📚 <b>关注系列新作更新</b>';
    subjectLine = `📚 <b>系列</b>：${escapeHtml(input.targetName)}`;
  }

  const lines = [heading, '──────────────────'];
  lines.push(subjectLine);

  if (input.code) {
    lines.push(`🔢 <b>识别码</b>：${escapeHtml(input.code)}`);
  }

  lines.push(`🎬 <b>标题</b>：${escapeHtml(displayTitle)}`);

  if (input.maker) {
    lines.push(`🏢 <b>制作商</b>：${escapeHtml(input.maker)}`);
  }

  // Genre display: prefer AI-enhanced format, fallback to plain hashtags
  if (input.enhancedGenres) {
    lines.push(`🏷️ <b>类别</b>：${input.enhancedGenres}`);
  } else if (input.genres && input.genres.length > 0) {
    const tags = input.genres.map((g) => `#${escapeHtml(g)}`).join(' ');
    lines.push(`🏷️ <b>类别</b>：${tags}`);
  }

  // Magnet section
  if (input.bestMagnet) {
    const magnet = input.bestMagnet;
    const hasCN = /字幕|中字|-C|CN|SUB/i.test(magnet.name);
    lines.push('──────────────────');
    lines.push(`🧲 <b>最优磁力${hasCN ? ' (含中字)' : ''}</b>`);
    lines.push(`<code>${escapeHtml(magnet.link)}</code>`);
    const details: string[] = [];
    details.push(`📦 <b>大小</b>：${escapeHtml(magnet.size)}`);
    if (magnet.shareDate) {
      details.push(`📅 <b>分享日期</b>：${escapeHtml(magnet.shareDate)}`);
    }
    lines.push(details.join(' | '));
  }

  // Link to JavBus page
  const safeUrl = normalizeUrl(input.link);
  if (safeUrl !== '#') {
    lines.push('──────────────────');
    lines.push(`🔗 <a href="${escapeHtml(safeUrl)}">查看作品详情</a>`);
  }

  // Footer tags
  const footerTags = ['#新作推送', '#磁力直达'];
  if (input.targetType === 'star') {
    footerTags.push(`#${input.targetName}`);
  } else if (input.targetType === 'series') {
    footerTags.push('#系列更新');
  }
  lines.push('──────────────────');
  lines.push(footerTags.join(' '));

  return lines.join('\n');
}

export function formatAvLabelSummaryMessage(input: AvLabelSummaryMessageInput): string {
  const heading = input.targetType === 'studio' ? '🏭 <b>制作商更新</b>' : '🏢 <b>发行商更新</b>';
  const footer = input.targetType === 'studio' ? '#制作商更新 #批量摘要' : '#发行商更新 #批量摘要';
  const lines = [
    `${heading}：${escapeHtml(input.targetName)}`,
    `最新更新日期：${escapeHtml(input.latestDate)}`,
    `本次新增：${input.totalNewCount} 部`,
    '',
  ];

  input.items.forEach((item, index) => {
    const title = item.title.trim() || '未知标题';
    const safeUrl = normalizeUrl(item.link);
    if (safeUrl !== '#') {
      lines.push(`${index + 1}) <a href="${escapeHtml(safeUrl)}">${escapeHtml(title)}</a>`);
    } else {
      lines.push(`${index + 1}) ${escapeHtml(title)}`);
    }
  });

  if (input.remainingCount > 0) {
    const safeUrl = normalizeUrl(input.targetLink);
    if (safeUrl !== '#') {
      lines.push(`… <a href="${escapeHtml(safeUrl)}">还有 ${input.remainingCount} 部</a>`);
    } else {
      lines.push(`… 还有 ${input.remainingCount} 部`);
    }
  }

  lines.push('');
  lines.push(footer);

  return lines.join('\n');
}
