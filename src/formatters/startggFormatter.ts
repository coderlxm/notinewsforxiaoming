import type {
  StartggFeaturedSeedCount,
  StartggWatchStatus,
} from '../services/startggRepository.js';
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

export function formatStartggFinalPhaseStarted(input: {
  tournamentName: string;
  eventName: string;
  eventSlug: string;
  phaseName: string;
  entrants: Array<{ seedNum: number; name: string }>;
}): string {
  const lines = [
    `🏆 <b>${escapeHtml(input.tournamentName)} / ${escapeHtml(input.eventName)} 已进入 ${escapeHtml(input.phaseName)}</b>`,
    '──────────────────',
    ...input.entrants.map((entrant) => `${entrant.seedNum}. ${escapeHtml(entrant.name)}`),
    '──────────────────',
    `🔗 <a href="${escapeHtml(normalizeUrl(`https://www.start.gg/${input.eventSlug}`))}">查看赛事</a>`,
  ];
  return lines.join('\n');
}

export function formatStartggFinalPhaseSetResult(input: {
  tournamentName: string;
  eventName: string;
  phaseName: string;
  roundLabel: string | null;
  entrantNames: string[];
  scoreText: string | null;
  winnerName: string;
  setUrl: string;
}): string {
  return [
    `🏆 <b>${escapeHtml(input.phaseName)} 赛果</b>`,
    `${escapeHtml(input.tournamentName)} / ${escapeHtml(input.eventName)}`,
    '',
    input.roundLabel ? escapeHtml(input.roundLabel) : null,
    escapeHtml(input.scoreText || input.entrantNames.join(' vs ')),
    `胜者：${escapeHtml(input.winnerName)}`,
    '',
    `🔎 <a href="${escapeHtml(normalizeUrl(input.setUrl))}">查看对局</a>`,
  ].filter((line): line is string => line !== null).join('\n');
}

export function formatStartggFinalStandings(input: {
  tournamentName: string;
  eventName: string;
  standings: Array<{ placement: number; entrantName: string }>;
}): string {
  const medal = (placement: number): string => {
    if (placement === 1) return '🥇';
    if (placement === 2) return '🥈';
    if (placement === 3) return '🥉';
    return `${placement}.`;
  };
  return [
    `🏆 <b>${escapeHtml(input.tournamentName)} / ${escapeHtml(input.eventName)} 最终结果</b>`,
    '──────────────────',
    ...input.standings.map((standing) => `${medal(standing.placement)} ${escapeHtml(standing.entrantName)}`),
  ].join('\n');
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
    lines.push('建议先执行自动监控：');
    lines.push('1. <code>/startgg go</code> 自动发现固定选手当前参加的赛事');
    lines.push('2. 如需手动指定项目，再使用 <code>/watch &lt;event_url&gt;</code>');
  } else {
    lines.push('常用命令：');
    lines.push('• <code>/startgg go</code> 自动发现并同步当前进行中的赛事');
    lines.push('• <code>/startgg go evo</code> 按赛事关键词自动发现项目、立即检查并开启轮询');
    lines.push('• <code>/watch &lt;选手名 | 用户链接 | 项目链接&gt;</code>');
    lines.push('• <code>/startgg status</code> 查看运行状态');
    lines.push('• <code>/watchlist</code> 查看监控对象和最近状态');
    lines.push('• <code>/fetchstartgg</code> 手动触发一次检查');
    lines.push('• <code>/startggpoll on</code> 开启每 15 分钟自动检查');
    lines.push('• <code>/startggpoll off</code> 关闭自动检查');
    lines.push('');
    lines.push('每次检查前都会自动同步固定选手并发现当前进行中的项目。');
  }
  lines.push('');
  lines.push('• <code>/startgg deleteall</code> 删除已记录的 start.gg 推送并清空历史状态');
  return lines.join('\n');
}

export function formatStartggGoTournamentCandidates(input: {
  reason: 'no_match' | 'multiple_matches';
  keyword: string;
  syncedPlayers: number;
  candidates: Array<{
    tournamentName: string;
    tournamentSlug: string;
    events: Array<{ eventName: string }>;
  }>;
}): string {
  const reasonText = input.reason === 'no_match'
    ? `没有命中「${escapeHtml(input.keyword)}」，请改用下面候选赛事的关键词。`
    : `「${escapeHtml(input.keyword)}」命中了多个赛事，请使用更具体的关键词。`;
  const lines = [
    '🥊 <b>start.gg go 候选赛事</b>',
    '──────────────────',
    reasonText,
    `固定选手：${input.syncedPlayers} 位`,
    '',
  ];

  input.candidates.forEach((candidate, index) => {
    const suggestedKeyword = candidate.tournamentSlug.replace(/^tournament\//, '');
    lines.push(`${index + 1}. ${escapeHtml(candidate.tournamentName)}`);
    lines.push(`   项目：${candidate.events.length} 个`);
    lines.push(`   命令：<code>/startgg go ${escapeHtml(suggestedKeyword)}</code>`);
  });

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

export interface StartggPlayerUpdateItem {
  playerName: string;
  status: StartggWatchStatus;
  placement: number | null;
  roundLabel: string | null;
  scoreText: string | null;
  setPageUrl: string | null;
}

export interface StartggFinalPhaseStartedItem {
  phaseName: string;
  entrants: Array<{ seedNum: number; name: string }>;
}

export interface StartggFinalPhaseSetResultItem {
  phaseName: string;
  roundLabel: string | null;
  entrantNames: string[];
  scoreText: string | null;
  winnerName: string;
  setUrl: string;
}

export interface StartggFeaturedSetResultItem {
  roundLabel: string | null;
  entrantNames: string[];
  scoreText: string | null;
  winnerName: string;
  setUrl: string;
}

export interface StartggFinalStandingsItem {
  standings: Array<{ placement: number; entrantName: string }>;
}

export interface StartggEventSummaryInput {
  tournamentName: string;
  eventName: string;
  eventSlug: string;
  playerUpdates: StartggPlayerUpdateItem[];
  featuredSetResults: StartggFeaturedSetResultItem[];
  finalPhaseStarted: StartggFinalPhaseStartedItem | null;
  finalPhaseSetResults: StartggFinalPhaseSetResultItem[];
  finalStandings: StartggFinalStandingsItem | null;
}

const TELEGRAM_MESSAGE_LIMIT = 4096;

function startggSummaryHeader(tournamentName: string, eventName: string): string[] {
  return [
    '🥊 <b>start.gg 赛事更新</b>',
    '──────────────────',
    `🏆 <b>赛事</b>：${escapeHtml(tournamentName)}`,
    `🎮 <b>项目</b>：${escapeHtml(eventName)}`,
    '──────────────────',
  ];
}

function startggSummaryFooter(eventSlug: string): string[] {
  return [
    '──────────────────',
    `🔗 <a href="${escapeHtml(normalizeUrl(`https://www.start.gg/${eventSlug}`))}">查看项目页</a>`,
  ];
}

function renderStartggPlayerSection(items: StartggPlayerUpdateItem[]): string[] {
  if (items.length === 0) return [];
  const lines: string[] = [`👤 <b>关注选手更新（${items.length} 条）</b>`];
  for (const item of items) {
    lines.push(`• ${escapeHtml(item.playerName)}：${statusLabel(item.status)}`);
    const segments: string[] = [];
    if (item.placement) segments.push(`名次 ${item.placement}`);
    if (item.roundLabel) segments.push(escapeHtml(item.roundLabel));
    if (item.scoreText) segments.push(`比分 ${escapeHtml(item.scoreText)}`);
    if (segments.length > 0) {
      lines.push(`  ${segments.join(' · ')}`);
    }
    if (item.setPageUrl) {
      lines.push(`  🔎 <a href="${escapeHtml(normalizeUrl(item.setPageUrl))}">查看对局</a>`);
    }
  }
  return lines;
}

function renderStartggFinalPhaseSection(input: {
  started: StartggFinalPhaseStartedItem | null;
  setResults: StartggFinalPhaseSetResultItem[];
  finalStandings: StartggFinalStandingsItem | null;
}): string[] {
  const { started, setResults, finalStandings } = input;
  if (!started && setResults.length === 0 && !finalStandings) return [];

  const phaseName = started?.phaseName ?? setResults[0]?.phaseName ?? null;
  const lines: string[] = [phaseName
    ? `🏁 <b>${escapeHtml(phaseName)}赛况</b>`
    : '🏁 <b>决赛阶段赛果</b>'];
  let appended = false;

  if (started) {
    if (appended) lines.push('');
    lines.push(`<b>${escapeHtml(started.phaseName)} 已开始</b>`);
    for (const entrant of started.entrants) {
      lines.push(`${entrant.seedNum}. ${escapeHtml(entrant.name)}`);
    }
    appended = true;
  }

  if (setResults.length > 0) {
    if (appended) lines.push('');
    lines.push(`<b>赛果（${setResults.length} 场）</b>`);
    for (const set of setResults) {
      const roundText = set.roundLabel ? `${escapeHtml(set.roundLabel)}：` : '';
      const score = set.scoreText ? escapeHtml(set.scoreText) : set.entrantNames.map(escapeHtml).join(' vs ');
      lines.push(`• ${roundText}${score} · 胜者 ${escapeHtml(set.winnerName)}`);
      lines.push(`  🔎 <a href="${escapeHtml(normalizeUrl(set.setUrl))}">查看对局</a>`);
    }
    appended = true;
  }

  if (finalStandings) {
    if (appended) lines.push('');
    lines.push('<b>最终排名</b>');
    for (const standing of finalStandings.standings) {
      const medal = standing.placement === 1
        ? '🥇'
        : standing.placement === 2
          ? '🥈'
          : standing.placement === 3
            ? '🥉'
            : `${standing.placement}.`;
      lines.push(`${medal} ${escapeHtml(standing.entrantName)}`);
    }
  }

  return lines;
}

function renderStartggFeaturedSection(items: StartggFeaturedSetResultItem[]): string[] {
  if (items.length === 0) return [];
  const lines: string[] = [`🌟 <b>种子选手赛果（${items.length} 场）</b>`];
  for (const item of items) {
    const roundText = item.roundLabel ? `${escapeHtml(item.roundLabel)}：` : '';
    const score = item.scoreText ? escapeHtml(item.scoreText) : item.entrantNames.map(escapeHtml).join(' vs ');
    lines.push(`• ${roundText}${score} · 胜者 ${escapeHtml(item.winnerName)}`);
    lines.push(`  🔎 <a href="${escapeHtml(normalizeUrl(item.setUrl))}">查看对局</a>`);
  }
  return lines;
}

export function buildStartggEventSummaryMessages(input: StartggEventSummaryInput): string[] {
  const playerLines = renderStartggPlayerSection(input.playerUpdates);
  const featuredLines = renderStartggFeaturedSection(input.featuredSetResults);
  const finalLines = renderStartggFinalPhaseSection({
    started: input.finalPhaseStarted,
    setResults: input.finalPhaseSetResults,
    finalStandings: input.finalStandings,
  });

  if (playerLines.length === 0 && featuredLines.length === 0 && finalLines.length === 0) return [];

  const header = startggSummaryHeader(input.tournamentName, input.eventName);
  const footer = startggSummaryFooter(input.eventSlug);

  const sections = [playerLines, featuredLines, finalLines].filter((s) => s.length > 0);
  const gaps = Array.from({ length: sections.length - 1 }, () => ['', '──────────────────', '']);

  const body: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    if (i > 0) body.push(...gaps[i - 1]!);
    body.push(...sections[i]!);
  }

  const combined = [...header, '', ...body, '', ...footer].join('\n');
  if (combined.length <= TELEGRAM_MESSAGE_LIMIT) {
    return [combined];
  }

  const messages: string[] = [];
  for (const section of sections) {
    const sectionTitle = section[0]!;
    let body = [sectionTitle];
    for (const line of section.slice(1)) {
      const candidate = [...header, '', ...body, line, '', ...footer].join('\n');
      if (candidate.length <= TELEGRAM_MESSAGE_LIMIT) {
        body.push(line);
        continue;
      }
      messages.push([...header, '', ...body, '', ...footer].join('\n'));
      body = [sectionTitle, line];
      if ([...header, '', ...body, '', ...footer].join('\n').length > TELEGRAM_MESSAGE_LIMIT) {
        throw new Error('start.gg summary line exceeds Telegram message limit.');
      }
    }
    messages.push([...header, '', ...body, '', ...footer].join('\n'));
  }
  return messages;
}

export function formatStartggRuntimeStatus(input: {
  pollingEnabled: boolean;
  nextPollAt: Date | null;
  fastPollingEnabled: boolean;
  nextFastPollAt: Date | null;
  players: Array<{ player_name: string; enabled: number }>;
  events: Array<{
    event_name: string;
    event_slug: string;
    active: number;
    tournament_end_at: string | null;
    final_phase_name: string | null;
    final_phase_num_seeds: number | null;
    final_phase_tracking_completed: number;
  }>;
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
  const tournamentEndAt = activeEvents.reduce<string | null>((latest, event) => {
    if (!event.tournament_end_at) return latest;
    if (!latest) return event.tournament_end_at;
    return new Date(event.tournament_end_at) > new Date(latest) ? event.tournament_end_at : latest;
  }, null);
  const latest = input.statuses[0] ?? null;
  const latestText = latest
    ? `${formatOptionalTime(latest.captured_at)} ${latest.player_name} ${statusLabel(latest.status)}`
    : '-';
  const finalPhaseText = activeEvents.length === 0
    ? '-'
    : activeEvents.map((event) => {
      if (event.final_phase_tracking_completed === 1) return `${event.event_name}：已完成`;
      if (event.final_phase_name && event.final_phase_num_seeds) {
        return `${event.event_name}：${event.final_phase_name} 跟踪中`;
      }
      return `${event.event_name}：等待发现`;
    }).join(' / ');

  return [
    '🥊 <b>start.gg 状态</b>',
    '──────────────────',
    `状态：<b>${state}</b>`,
    `赛事：${escapeHtml(eventText)}`,
    `赛事结束：${formatOptionalTime(tournamentEndAt)}`,
    `选手：${enabledPlayers.length} 位 ${escapeHtml(playerText)}`,
    `决赛阶段：${escapeHtml(finalPhaseText)}`,
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

function seedCountLabel(count: StartggFeaturedSeedCount): string {
  if (count === 16) return 'Top 16';
  if (count === 32) return 'Top 32';
  return '关闭';
}

export function formatStartggGoStartedCard(input: {
  tournamentName: string;
  eventName: string;
  playerCount: number;
  seedCount: StartggFeaturedSeedCount;
  syncedCount: number;
}): string {
  const seedText = input.seedCount === 0
    ? '关闭'
    : `Top ${input.seedCount}（已同步 ${input.syncedCount} 位）`;

  return [
    '🥊 <b>start.gg 监控已启动</b>',
    '──────────────────',
    `赛事：${escapeHtml(input.tournamentName)}`,
    `固定关注：${input.playerCount} 位`,
    `种子关注：${seedText}`,
    `项目：${escapeHtml(input.eventName)}`,
    '固定轮询：15 分钟',
  ].join('\n');
}

export function buildStartggSeedsButtons(seedCount: StartggFeaturedSeedCount): { reply_markup: InlineKeyboardMarkup } {
  const top16Label = seedCount === 16 ? '✅ Top 16' : 'Top 16';
  const top32Label = seedCount === 32 ? '✅ Top 32' : 'Top 32';
  const offLabel = seedCount === 0 ? '✅ 已关闭种子关注' : '关闭种子关注';

  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: top16Label, callback_data: 'sgseeds:16' },
          { text: top32Label, callback_data: 'sgseeds:32' },
        ],
        [
          { text: offLabel, callback_data: 'sgseeds:0' },
          { text: '查看种子清单', callback_data: 'sgseeds:list' },
        ],
      ],
    },
  };
}

export function formatStartggSeedsList(input: {
  eventName: string;
  seedCount: StartggFeaturedSeedCount;
  entrants: Array<{ seedNum: number; entrantName: string }>;
  syncedAt: string;
}): string {
  const lines = [
    '🌟 <b>种子关注清单</b>',
    '──────────────────',
    `赛事：${escapeHtml(input.eventName)}`,
    `档位：${escapeHtml(seedCountLabel(input.seedCount))}`,
    `已同步：${input.entrants.length} 位`,
    '──────────────────',
  ];

  if (input.entrants.length === 0) {
    lines.push('（种子关注已关闭或无可用数据）');
  } else {
    for (const entrant of input.entrants) {
      lines.push(`${entrant.seedNum}. ${escapeHtml(entrant.entrantName)}`);
    }
  }

  lines.push('──────────────────');
  lines.push(`最近同步：${escapeHtml(input.syncedAt)}`);

  return lines.join('\n');
}

export function buildStartggSeedsListButtons(): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 返回监控状态', callback_data: 'sgseeds:status' }],
      ],
    },
  };
}

export function formatStartggInterestPrompt(input: {
  playerNames: string[];
  videogameName: string;
  tournamentName: string;
}): string {
  return [
    '🎮 <b>发现关注选手参加新项目</b>',
    '──────────────────',
    `选手：${escapeHtml(input.playerNames.join(' / '))}`,
    `项目：${escapeHtml(input.videogameName)}`,
    `赛事：${escapeHtml(input.tournamentName)}`,
    '',
    '选择前不会推送该项目的赛事消息。',
  ].join('\n');
}

export function buildStartggInterestPromptButtons(
  pendingEventId: number,
): { reply_markup: InlineKeyboardMarkup } {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '关注这个项目', callback_data: `sginterest:follow:${pendingEventId}` }],
        [
          { text: '仅关注本届', callback_data: `sginterest:event:${pendingEventId}` },
          { text: '忽略这个项目', callback_data: `sginterest:ignore:${pendingEventId}` },
        ],
      ],
    },
  };
}
