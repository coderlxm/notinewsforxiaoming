import type { StartggWatchStatus } from '../services/startggRepository';
import { escapeHtml } from '../utils/html';

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

interface InlineKeyboardMarkup {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
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

export function formatStartggGuide(playersCount: number, eventsCount: number): string {
  const isEmpty = playersCount === 0 || eventsCount === 0;
  const lines = [
    '🥊 <b>start.gg 监控助手</b>',
    '──────────────────',
    `当前配置：${playersCount} 位选手，${eventsCount} 个项目`,
    '',
  ];

  if (isEmpty) {
    lines.push('建议按这两步完成首次配置：');
    lines.push('1. <code>/watch Tokido</code> 或 <code>/watch https://www.start.gg/user/xxxx</code>');
    lines.push('2. <code>/watch https://www.start.gg/tournament/xxx/event/yyy</code>');
  } else {
    lines.push('常用命令：');
    lines.push('• <code>/watch &lt;选手名 | 用户链接 | 项目链接&gt;</code>');
    lines.push('• <code>/watchlist</code> 查看监控对象和最近状态');
    lines.push('• <code>/fetchstartgg</code> 手动触发一次检查');
    lines.push('');
    lines.push('添加项目后直接检查，不再按赛事时间窗口跳过。');
  }
  return lines.join('\n');
}

export function formatStartggWatchCandidates(
  query: string,
  candidates: Array<{ playerName: string; eventName: string; playerId: number }>,
): string {
  const lines = [
    `🔎 找到多个候选「<b>${escapeHtml(query)}</b>」，请选择：`,
    '──────────────────',
  ];
  candidates.forEach((candidate, index) => {
    lines.push(`${index + 1}. ${escapeHtml(candidate.playerName)}（${escapeHtml(candidate.eventName)}，player_id=${candidate.playerId}）`);
  });
  lines.push('──────────────────');
  lines.push('点击下方按钮即可添加。');
  return lines.join('\n');
}

export function buildStartggWatchCandidateButtons(
  candidates: Array<{ eventRowId: number; playerId: number; playerName: string }>,
): { reply_markup: InlineKeyboardMarkup } {
  const rows = candidates.map((candidate, index) => [{
    text: `${index + 1}. ${candidate.playerName}`,
    callback_data: `sgwatch:add:${candidate.eventRowId}:${candidate.playerId}`,
  }]);
  return { reply_markup: { inline_keyboard: rows } };
}

export function formatStartggWatchList(
  players: Array<{ player_id: number; player_name: string; enabled: number }>,
  events: Array<{ event_slug: string; event_name: string; active: number }>,
  statuses: Array<{
    player_name: string;
    event_name: string;
    status: StartggWatchStatus;
    placement: number | null;
    last_set_round_label: string | null;
    last_set_score_text: string | null;
  }>,
): string {
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

  lines.push('');
  lines.push('<b>最近状态：</b>');
  if (statuses.length === 0) {
    lines.push('（暂无快照，等待下一次检查）');
  } else {
    statuses.slice(0, 10).forEach((status, index) => {
      const details: string[] = [];
      if (status.placement) details.push(`名次 ${status.placement}`);
      if (status.last_set_round_label) details.push(status.last_set_round_label);
      if (status.last_set_score_text) details.push(`比分 ${status.last_set_score_text}`);
      const suffix = details.length > 0 ? `，${escapeHtml(details.join('，'))}` : '';
      lines.push(
        `${index + 1}. ${escapeHtml(status.player_name)} @ ${escapeHtml(status.event_name)}：${escapeHtml(statusLabel(status.status))}${suffix}`
      );
    });
  }
  return lines.join('\n');
}
