import type { StartggWatchStatus } from '../services/startggRepository';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeUrl(url: string | null): string {
  if (!url) {
    throw new Error('URL is empty.');
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  throw new Error(`Unsupported URL protocol: ${url}`);
}

function statusLabel(status: StartggWatchStatus): string {
  if (status === 'not_entered') return '未在该项目出战';
  if (status === 'in_winners') return '胜者组进行中';
  if (status === 'in_losers') return '败者组进行中';
  if (status === 'completed') return '赛事已完赛';
  return '已淘汰';
}

export interface StartggStatusChangedMessageInput {
  tournamentName: string;
  eventName: string;
  eventSlug: string;
  playerName: string;
  status: StartggWatchStatus;
  placement: number | null;
  roundLabel: string | null;
  scoreText: string | null;
  setPageUrl: string | null;
}

export function formatStartggStatusChangedMessage(input: StartggStatusChangedMessageInput): string {
  const lines = [
    '🥊 <b>start.gg 选手状态更新</b>',
    '──────────────────',
    `🏆 <b>赛事</b>：${escapeHtml(input.tournamentName)}`,
    `🎮 <b>项目</b>：${escapeHtml(input.eventName)}`,
    `👤 <b>选手</b>：${escapeHtml(input.playerName)}`,
    `📌 <b>状态</b>：${escapeHtml(statusLabel(input.status))}`,
  ];

  if (input.placement) {
    lines.push(`🏁 <b>当前名次</b>：${input.placement}`);
  }
  if (input.roundLabel) {
    lines.push(`🧭 <b>最新轮次</b>：${escapeHtml(input.roundLabel)}`);
  }
  if (input.scoreText) {
    lines.push(`📝 <b>最新比分</b>：${escapeHtml(input.scoreText)}`);
  }

  lines.push('──────────────────');

  const eventUrl = normalizeUrl(`https://www.start.gg/${input.eventSlug}`);
  lines.push(`🔗 <a href="${escapeHtml(eventUrl)}">查看项目页</a>`);

  if (input.setPageUrl) {
    const setUrl = normalizeUrl(input.setPageUrl);
    lines.push(`🔎 <a href="${escapeHtml(setUrl)}">查看最近对局</a>`);
  }

  return lines.join('\n');
}

export function formatStartggWatchList(players: Array<{ player_id: number; player_name: string; enabled: number }>, events: Array<{ event_slug: string; event_name: string; active: number }>): string {
  const lines = ['🎯 <b>start.gg 监控列表</b>', ''];
  lines.push('<b>选手：</b>');
  if (players.length === 0) {
    lines.push('（空）');
  } else {
    players.forEach((player, index) => {
      const status = player.enabled === 1 ? '启用' : '停用';
      lines.push(`${index + 1}. ${escapeHtml(player.player_name)} (player_id=${player.player_id}, ${status})`);
    });
  }

  lines.push('');
  lines.push('<b>项目：</b>');
  if (events.length === 0) {
    lines.push('（空）');
  } else {
    events.forEach((event, index) => {
      const status = event.active === 1 ? '启用' : '停用';
      lines.push(`${index + 1}. ${escapeHtml(event.event_name)} (${escapeHtml(event.event_slug)}, ${status})`);
    });
  }
  return lines.join('\n');
}
