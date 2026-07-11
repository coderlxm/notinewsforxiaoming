import type { Telegraf } from 'telegraf';
import { formatStartggStatusChangedMessage } from '../../formatters/startggFormatter.js';
import { sendTelegramMessageWithId } from '../../publishers/telegram.js';
import {
  findStartggWatchSnapshot,
  listActiveStartggWatchEvents,
  listEnabledStartggWatchPlayers,
  type StartggWatchStatus,
  upsertStartggWatchSnapshot,
  updateStartggWatchEventResolved,
  upsertStartggWatchEventEntrant,
  findStartggWatchEventEntrant,
  type StartggWatchPlayer,
  type StartggWatchEvent,
  hasStartggPushedSet,
  markStartggPushedSet,
  markStartggInitialMessageSent,
  recordStartggSentMessage,
} from '../startggRepository.js';
import {
  fetchEventHeader,
  fetchEventSetsByEntrants,
  fetchEntrantStandings,
  fetchEventEntrantsDetailed,
  fetchEventBasic,
  fetchUserPlayer,
} from './client.js';
import type { TrackedSetNode, TrackedStandingNode } from './queries.js';

export function normalizeEventSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('start.gg event slug cannot be empty.');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const tournamentIndex = parts.indexOf('tournament');
    const eventIndex = parts.indexOf('event');
    if (tournamentIndex < 0 || eventIndex < 0 || eventIndex !== tournamentIndex + 2) {
      throw new Error(`Invalid start.gg event URL: ${raw}`);
    }
    const tournamentSlug = parts[tournamentIndex + 1];
    const eventSlug = parts[eventIndex + 1];
    if (!tournamentSlug || !eventSlug) {
      throw new Error(`Invalid start.gg event URL: ${raw}`);
    }
    return `tournament/${tournamentSlug}/event/${eventSlug}`;
  }
  return trimmed.replace(/^\/+/, '');
}

export function normalizeUserSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('start.gg user slug cannot be empty.');
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    const userIndex = parts.indexOf('user');
    if (userIndex < 0 || !parts[userIndex + 1]) {
      throw new Error(`Invalid start.gg user URL: ${raw}`);
    }
    return parts[userIndex + 1]!;
  }
  return trimmed.replace(/^\/+/, '').replace(/^user\//, '').split('/')[0] ?? trimmed;
}

function buildPlayerDisplayName(gamerTag: string | null, prefix: string | null): string {
  const gamer = gamerTag?.trim() ?? '';
  const org = prefix?.trim() ?? '';
  if (org && gamer) {
    return `${org} | ${gamer}`;
  }
  return gamer || org;
}

export interface StartggEventMeta {
  id: number;
  name: string;
  slug: string;
  tournamentName: string | null;
  eventStartAt: number | null;
  tournamentStartAt: number | null;
  tournamentEndAt: number | null;
}

export interface StartggEventEntrantPlayer {
  playerId: number;
  playerName: string;
  entrantId: number;
  entrantName: string;
}

export interface StartggUserResolvedPlayer {
  playerId: number;
  playerName: string;
  userSlug: string;
}

export async function fetchEventMeta(rawEventSlugOrUrl: string): Promise<StartggEventMeta> {
  const slug = normalizeEventSlug(rawEventSlugOrUrl);
  const event = await fetchEventBasic(slug);
  if (!event?.slug) {
    throw new Error(`start.gg 项目不存在：${slug}`);
  }
  return {
    id: event.id,
    name: event.name,
    slug: normalizeEventSlug(event.slug),
    tournamentName: event.tournament?.name ?? null,
    eventStartAt: event.startAt ?? null,
    tournamentStartAt: event.tournament?.startAt ?? null,
    tournamentEndAt: event.tournament?.endAt ?? null,
  };
}

export async function listEventEntrantPlayers(rawEventSlugOrUrl: string): Promise<StartggEventEntrantPlayer[]> {
  const slug = normalizeEventSlug(rawEventSlugOrUrl);
  const allEntrants = await fetchEventEntrantsDetailed(slug);
  const unique = new Map<number, StartggEventEntrantPlayer>();
  for (const entrant of allEntrants) {
    for (const participant of entrant.participants) {
      const player = participant.player;
      if (!player) continue;
      if (unique.has(player.id)) continue;
      const playerName = buildPlayerDisplayName(player.gamerTag, player.prefix);
      if (!playerName) continue;
      unique.set(player.id, {
        playerId: player.id,
        playerName,
        entrantId: entrant.id,
        entrantName: entrant.name,
      });
    }
  }
  return Array.from(unique.values());
}

export async function resolveUserToPlayer(rawUserSlugOrUrl: string): Promise<StartggUserResolvedPlayer> {
  const slug = normalizeUserSlug(rawUserSlugOrUrl);
  const user = await fetchUserPlayer(slug);
  if (!user) {
    throw new Error(`start.gg 用户不存在：${slug}`);
  }
  if (!user.player) {
    throw new Error('该 start.gg 用户没有关联 player，无法用于赛事状态追踪。');
  }
  const playerName = buildPlayerDisplayName(user.player.gamerTag, user.player.prefix);
  if (!playerName) {
    throw new Error(`start.gg 用户 player 名称为空：${slug}`);
  }
  return {
    playerId: user.player.id,
    playerName,
    userSlug: user.slug ?? slug,
  };
}

interface PlayerStatusSnapshot {
  status: StartggWatchStatus;
  placement: number | null;
  lastSetId: number | null;
  lastSetRound: number | null;
  lastSetRoundLabel: string | null;
  lastSetScoreText: string | null;
  lastSetState: number | null;
  setPageUrl: string | null;
  activeSetExists: boolean;
}

export interface StartggWatchSummary {
  checkedPlayers: number;
  changed: number;
  checkedEvents: number;
  activeSetCount: number;
  activeEventSlugs: string[];
}

export interface RunStartggWatchOptions {
  eventSlugs?: string[];
  refreshEntrantMappings?: boolean;
  refreshEventMeta?: boolean;
}

function buildSetScoreText(displayScore: string | null): string | null {
  if (displayScore && displayScore.trim()) {
    return displayScore.trim();
  }
  return null;
}

function compareSetRecency(a: { completedAt: number | null; id: number }, b: { completedAt: number | null; id: number }): number {
  const aTime = a.completedAt ?? 0;
  const bTime = b.completedAt ?? 0;
  if (aTime !== bTime) {
    return bTime - aTime;
  }
  return b.id - a.id;
}

async function ensureEventEntrantMappings(
  eventSlug: string,
  watchEventId: number,
  players: StartggWatchPlayer[],
  refreshMissing: boolean,
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();
  const playersNeedingMapping: StartggWatchPlayer[] = [];

  for (const player of players) {
    const existing = findStartggWatchEventEntrant(player.id, watchEventId);
    if (existing?.entrant_id !== null && existing?.entrant_id !== undefined) {
      result.set(player.id, existing.entrant_id);
    } else if (!refreshMissing) {
      result.set(player.id, null);
    } else {
      playersNeedingMapping.push(player);
    }
  }

  if (playersNeedingMapping.length === 0) {
    return result;
  }

  const allEntrants = await listEventEntrantPlayers(eventSlug);
  const entrantByPlayerId = new Map(allEntrants.map((entrant) => [entrant.playerId, entrant]));

  for (const player of playersNeedingMapping) {
    const entrant = entrantByPlayerId.get(player.player_id) ?? null;

    if (entrant) {
      upsertStartggWatchEventEntrant({
        watch_player_id: player.id,
        watch_event_id: watchEventId,
        entrant_id: entrant.entrantId,
        entrant_name: entrant.entrantName,
      });
    }

    result.set(player.id, entrant?.entrantId ?? null);
  }

  return result;
}

function computePlayerSnapshot(
  eventSlug: string,
  playerSets: TrackedSetNode[],
  entrantId: number | null,
  standings: TrackedStandingNode[],
): PlayerStatusSnapshot {
  if (!eventSlug) {
    throw new Error(`Event slug is empty: ${eventSlug}`);
  }

  if (!entrantId) {
    return {
      status: 'not_entered',
      placement: null,
      lastSetId: null,
      lastSetRound: null,
      lastSetRoundLabel: null,
      lastSetScoreText: null,
      lastSetState: null,
      setPageUrl: null,
      activeSetExists: false,
    };
  }

  playerSets.sort(compareSetRecency);
  const latestSet = playerSets[0] ?? null;
  const latestSetLost = latestSet?.winnerId !== null && latestSet?.winnerId !== undefined && latestSet.winnerId !== entrantId;
  const inLosersSignal = Boolean(
    (latestSet?.round !== null && latestSet?.round !== undefined && latestSet.round < 0)
    || (latestSet?.fullRoundText && /losers/i.test(latestSet.fullRoundText)),
  );
  const activeSetExists = playerSets.some((set) => set.startedAt !== null && set.completedAt === null);
  const standing = standings.find((node) => node.entrant?.id === entrantId) ?? null;

  let status: StartggWatchStatus;
  if (latestSet && latestSetLost) {
    if (activeSetExists || inLosersSignal || !standing?.isFinal) {
      status = 'in_losers';
    } else {
      status = 'eliminated';
    }
  } else if (inLosersSignal) {
    status = 'in_losers';
  } else {
    status = 'in_winners';
  }

  if (standing?.placement === 1 && standing.isFinal && !activeSetExists) {
    status = 'completed';
  }

  const setId = latestSet?.id ?? null;
  const normalizedSlug = normalizeEventSlug(eventSlug);
  const setPageUrl = setId ? `https://www.start.gg/${normalizedSlug}/set/${setId}` : null;

  return {
    status,
    placement: standing?.placement ?? null,
    lastSetId: setId,
    lastSetRound: latestSet?.round ?? null,
    lastSetRoundLabel: latestSet?.fullRoundText ?? null,
    lastSetScoreText: latestSet ? buildSetScoreText(latestSet.displayScore) : null,
    lastSetState: latestSet?.state ?? null,
    setPageUrl,
    activeSetExists,
  };
}

function hasSnapshotChanged(
  current: PlayerStatusSnapshot,
  previous: ReturnType<typeof findStartggWatchSnapshot>,
): boolean {
  if (!previous) return true;
  return current.status !== previous.status
    || current.placement !== previous.placement
    || current.lastSetId !== previous.last_set_id
    || current.lastSetScoreText !== previous.last_set_score_text;
}

function compareSetChronology(a: { completedAt: number | null; id: number }, b: { completedAt: number | null; id: number }): number {
  const aTime = a.completedAt ?? 0;
  const bTime = b.completedAt ?? 0;
  if (aTime !== bTime) {
    return aTime - bTime;
  }
  return a.id - b.id;
}

function selectSetsToPush(
  playerSets: TrackedSetNode[],
  previous: ReturnType<typeof findStartggWatchSnapshot>,
  watchPlayerId: number,
  watchEventId: number,
): TrackedSetNode[] {
  if (!previous) {
    for (const set of playerSets) {
      markStartggPushedSet(watchPlayerId, watchEventId, set.id);
    }
    const latestSet = [...playerSets].sort(compareSetRecency)[0];
    return latestSet ? [latestSet] : [];
  }

  const sortedSets = [...playerSets].sort(compareSetChronology);
  if (previous.last_set_id !== null) {
    const previousSetIndex = sortedSets.findIndex((set) => set.id === previous.last_set_id);
    if (previousSetIndex < 0) {
      throw new Error(`start.gg previous set missing from fetched sets: ${previous.last_set_id}`);
    }
    for (const set of sortedSets.slice(0, previousSetIndex + 1)) {
      markStartggPushedSet(watchPlayerId, watchEventId, set.id);
    }
    return sortedSets
      .slice(previousSetIndex + 1)
      .filter((set) => !hasStartggPushedSet(watchPlayerId, watchEventId, set.id));
  }

  return sortedSets
    .filter((set) => !hasStartggPushedSet(watchPlayerId, watchEventId, set.id));
}

interface EventProcessResult {
  changed: number;
  activeSetCount: number;
}

async function processEvent(
  eventRow: StartggWatchEvent,
  players: StartggWatchPlayer[],
  bot: Telegraf | undefined,
  refreshEntrantMappings: boolean,
  refreshEventMeta: boolean,
): Promise<EventProcessResult> {
  const normalizedSlug = normalizeEventSlug(eventRow.event_slug);
  let tournamentName = eventRow.tournament_name;
  let eventDisplayName = eventRow.event_display_name;
  let resolvedEventSlug = normalizedSlug;
  if (refreshEventMeta) {
    const header = await fetchEventHeader(normalizedSlug);
    if (!header?.slug) {
      throw new Error(`start.gg event not found or missing slug: ${normalizedSlug}`);
    }
    if (!header.tournament?.name || header.tournament.endAt === null) {
      throw new Error(`start.gg event missing tournament metadata: ${normalizedSlug}`);
    }
    tournamentName = header.tournament.name;
    eventDisplayName = header.name;
    resolvedEventSlug = header.slug;
    updateStartggWatchEventResolved(
      eventRow.id,
      header.id,
      `${tournamentName} / ${eventDisplayName}`,
      new Date(header.tournament.endAt * 1000).toISOString(),
      tournamentName,
      eventDisplayName,
    );
  }
  if (!tournamentName || !eventDisplayName) {
    throw new Error(`start.gg event missing cached metadata: ${normalizedSlug}`);
  }

  const entrantMappings = await ensureEventEntrantMappings(
    normalizedSlug,
    eventRow.id,
    players,
    refreshEntrantMappings,
  );

  const mappedEntrantIds = Array.from(entrantMappings.values()).filter((id): id is number => id !== null);
  const [entrantSets, eventStandings] = await Promise.all([
    mappedEntrantIds.length > 0
      ? fetchEventSetsByEntrants(normalizedSlug, mappedEntrantIds)
      : Promise.resolve([]),
    mappedEntrantIds.length > 0
      ? fetchEntrantStandings(mappedEntrantIds)
      : Promise.resolve([]),
  ]);

  let changed = 0;
  let activeSetCount = 0;

  for (const player of players) {
    const entrantId = entrantMappings.get(player.id) ?? null;
    const eventPlayerName = findStartggWatchEventEntrant(player.id, eventRow.id)?.entrant_name
      ?? player.player_name;
    const playerSets = entrantSets.filter((set) =>
      set.slots.some((slot) => slot.entrant?.id === entrantId),
    );

    const snapshot = computePlayerSnapshot(normalizedSlug, playerSets, entrantId, eventStandings);
    if (snapshot.activeSetExists) {
      activeSetCount += 1;
    }
    const previous = findStartggWatchSnapshot(player.id, eventRow.id);
    const initialMessagePending = !previous || previous.initial_message_sent === 0;
    const setsToPush = selectSetsToPush(playerSets, previous, player.id, eventRow.id);
    upsertStartggWatchSnapshot({
      watch_player_id: player.id,
      watch_event_id: eventRow.id,
      status: snapshot.status,
      placement: snapshot.placement,
      last_set_id: snapshot.lastSetId,
      last_set_round: snapshot.lastSetRound,
      last_set_round_label: snapshot.lastSetRoundLabel,
      last_set_score_text: snapshot.lastSetScoreText,
      last_set_state: snapshot.lastSetState,
      captured_at: new Date().toISOString(),
    });

    if (initialMessagePending) {
      if (playerSets.length === 0) continue;

      for (const set of playerSets) {
        markStartggPushedSet(player.id, eventRow.id, set.id);
      }

      changed += 1;
      const message = formatStartggStatusChangedMessage({
        tournamentName,
        eventName: eventDisplayName,
        eventSlug: resolvedEventSlug,
        playerName: eventPlayerName,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: snapshot.lastSetRoundLabel,
        scoreText: snapshot.lastSetScoreText,
        setPageUrl: snapshot.setPageUrl,
      });
      const messageId = await sendTelegramMessageWithId(message, bot);
      recordStartggSentMessage(messageId);
      markStartggInitialMessageSent(player.id, eventRow.id);
      continue;
    }

    const changedNow = hasSnapshotChanged(snapshot, previous);
    if (setsToPush.length === 0 && !changedNow) continue;

    if (setsToPush.length === 0) {
      changed += 1;
      const message = formatStartggStatusChangedMessage({
        tournamentName,
        eventName: eventDisplayName,
        eventSlug: resolvedEventSlug,
        playerName: eventPlayerName,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: snapshot.lastSetRoundLabel,
        scoreText: snapshot.lastSetScoreText,
        setPageUrl: snapshot.setPageUrl,
      });
      const messageId = await sendTelegramMessageWithId(message, bot);
      recordStartggSentMessage(messageId);
      continue;
    }

    for (const set of setsToPush) {
      changed += 1;
      const setPageUrl = `https://www.start.gg/${normalizedSlug}/set/${set.id}`;
      const message = formatStartggStatusChangedMessage({
        tournamentName,
        eventName: eventDisplayName,
        eventSlug: resolvedEventSlug,
        playerName: eventPlayerName,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: set.fullRoundText,
        scoreText: buildSetScoreText(set.displayScore),
        setPageUrl,
      });
      const messageId = await sendTelegramMessageWithId(message, bot);
      recordStartggSentMessage(messageId);
      markStartggPushedSet(player.id, eventRow.id, set.id);
    }
  }

  return { changed, activeSetCount };
}

export async function runStartggWatchOnce(bot?: Telegraf, options?: RunStartggWatchOptions): Promise<StartggWatchSummary> {
  const players = listEnabledStartggWatchPlayers();
  const events = listActiveStartggWatchEvents();
  const normalizedEventFilter = options?.eventSlugs
    ? new Set(options.eventSlugs.map((slug) => normalizeEventSlug(slug)))
    : null;
  const targetEvents = normalizedEventFilter
    ? events.filter((row) => normalizedEventFilter.has(normalizeEventSlug(row.event_slug)))
    : events;

  const results = await Promise.all(
    targetEvents.map((eventRow) => processEvent(
      eventRow,
      players,
      bot,
      options?.refreshEntrantMappings !== false,
      options?.refreshEventMeta !== false,
    )),
  );

  return {
    checkedPlayers: players.length,
    checkedEvents: targetEvents.length,
    changed: results.reduce((sum, r) => sum + r.changed, 0),
    activeSetCount: results.reduce((sum, r) => sum + r.activeSetCount, 0),
    activeEventSlugs: targetEvents
      .filter((_, index) => results[index]!.activeSetCount > 0)
      .map((event) => normalizeEventSlug(event.event_slug)),
  };
}
