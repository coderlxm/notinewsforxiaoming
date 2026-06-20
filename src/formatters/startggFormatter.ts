import type { StartggWatchStatus } from '../services/startggRepository.js';
import { escapeHtml } from '../utils/html.js';
import { bjFormat } from '../utils/time.js';

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
    lines.push('• <code>/startgg status</code> 查看运行状态');
    lines.push('• <code>/watchlist</code> 查看监控对象和最近状态');
    lines.push('• <code>/fetchstartgg</code> 手动触发一次检查');
    lines.push('• <code>/startggpoll on</code> 开启每 20 分钟自动检查');
    lines.push('• <code>/startggpoll off</code> 关闭自动检查');
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

function formatOptionalTime(value: Date | string | null): string {
  return value ? bjFormat(value, 'HH:mm:ss') : '-';
}

function compactNames(names: string[], limit: number): string {
  if (names.length <= limit) return names.join(' / ');
  return `${names.slice(0, limit).join(' / ')} / +${names.length - limit}`;
}

export function formatStartggRuntimeStatus(input: {
  pollingEnabled: boolean;
  nextPollAt: Date | null;
  fastPollingEnabled: boolean;
  nextFastPollAt: Date | null;
  players: Array<{ player_name: string; enabled: number }>;
  events: Array<{ event_name: string; event_slug: string; active: number }>;
  statuses: Array<{
    player_name: string;
    status: StartggWatchStatus;
    placement: number | null;
    last_set_round_label: string | null;
    last_set_score_text: string | null;
    captured_at: string;
  }>;
}): string {
  const enabledPlayers = input.players.filter((player) => player.enabled === 1);
  const activeEvents = input.events.filter((event) => event.active === 1);
  const configured = enabledPlayers.length > 0 && activeEvents.length > 0;
  const running = configured && (input.pollingEnabled || input.fastPollingEnabled);
  const state = !configured ? '未配置' : running ? '监控中' : '待命';
  const eventText = activeEvents.length === 0
    ? '-'
    : activeEvents.length === 1
      ? activeEvents[0]!.event_name
      : `${activeEvents[0]!.event_name} / +${activeEvents.length - 1}`;
  const playerText = enabledPlayers.length === 0
    ? '-'
    : compactNames(enabledPlayers.map((player) => player.player_name), 5);
  const latest = input.statuses[0] ?? null;
  const latestText = latest
    ? `${formatOptionalTime(latest.captured_at)} ${latest.player_name} ${statusLabel(latest.status)}`
    : '-';

  return [
    '🥊 <b>start.gg 状态</b>',
    '──────────────────',
    `状态：<b>${state}</b>`,
    `赛事：${escapeHtml(eventText)}`,
    `选手：${enabledPlayers.length} 位 ${escapeHtml(playerText)}`,
    `固定轮询：${input.pollingEnabled ? '开' : '关'}，下次 ${formatOptionalTime(input.nextPollAt)}`,
    `加速轮询：${input.fastPollingEnabled ? '开' : '关'}，下次 ${formatOptionalTime(input.nextFastPollAt)}`,
    `最近快照：${escapeHtml(latestText)}`,
  ].join('\n');
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
