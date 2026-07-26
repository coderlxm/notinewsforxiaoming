import type { Telegraf } from 'telegraf';
import {
  buildStartggEventSummaryMessages,
  type StartggEventSummaryInput,
  type StartggFinalPhaseSetResultItem,
  type StartggFinalPhaseStartedItem,
  type StartggFinalStandingsItem,
  type StartggPlayerUpdateItem,
  type StartggFeaturedSetResultItem,
} from '../../formatters/startggFormatter.js';
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
  hasAnyStartggPlayerPushedSet,
  hasStartggEventPushedSet,
  markStartggEventPushedSet,
  markStartggFinalPhaseTrackingCompleted,
  updateStartggWatchEventFinalPhase,
  listEventFeaturedEntrants,
} from '../startggRepository.js';
import {
  fetchEventHeader,
  fetchEventSetsByEntrants,
  fetchEntrantStandings,
  fetchEventEntrantsDetailed,
  fetchEventBasic,
  fetchUserPlayer,
  fetchEventFinalPhaseMeta,
  fetchEventStandings,
  fetchPhaseSeeds,
  fetchPhaseTracking,
} from './client.js';
import type { TrackedSetNode, TrackedStandingNode } from './queries.js';
import {
  resolveStartggEntrantIdentities,
  type StartggEntrantIdentityCandidate,
} from '../startggIdentity.js';

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
  videogameId: number | null;
  videogameName: string | null;
  eventStartAt: number | null;
  tournamentStartAt: number | null;
  tournamentEndAt: number | null;
}

export interface StartggEventEntrantPlayer {
  playerId: number;
  playerName: string;
  userId: number | null;
  gamerTag: string;
  entrantId: number;
  entrantName: string;
}

export interface StartggUserResolvedPlayer {
  userId: number;
  playerId: number;
  playerName: string;
  gamerTag: string;
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
    videogameId: event.videogame?.id ?? null,
    videogameName: event.videogame?.name ?? null,
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
      const gamerTag = player.gamerTag?.trim() || participant.gamerTag?.trim();
      if (!gamerTag) continue;
      const playerName = buildPlayerDisplayName(gamerTag, player.prefix);
      if (!playerName) continue;
      unique.set(player.id, {
        playerId: player.id,
        playerName,
        userId: participant.user?.id ?? null,
        gamerTag,
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
  const gamerTag = user.player.gamerTag?.trim();
  if (!gamerTag) {
    throw new Error(`start.gg 用户 player gamerTag 为空：${slug}`);
  }
  const playerName = buildPlayerDisplayName(user.player.gamerTag, user.player.prefix);
  if (!playerName) {
    throw new Error(`start.gg 用户 player 名称为空：${slug}`);
  }
  return {
    userId: user.id,
    playerId: user.player.id,
    playerName,
    gamerTag,
    userSlug: user.slug ?? slug,
  };
}

function buildEventEntrantIdentityCandidates(
  eventSlug: string,
  eventId: number,
  entrants: Awaited<ReturnType<typeof fetchEventEntrantsDetailed>>,
): StartggEntrantIdentityCandidate[] {
  return entrants.flatMap((entrant) => entrant.participants.map((participant) => ({
    tournamentId: 0,
    participantId: participant.id,
    eventId,
    eventName: eventSlug,
    eventSlug,
    entrantId: entrant.id,
    entrantName: entrant.name,
    userId: participant.user?.id ?? null,
    playerId: participant.player?.id ?? null,
    gamerTag: participant.gamerTag,
  })));
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

function compareSetRecency(
  a: { completedAt: number | null; startedAt: number | null; id: number },
  b: { completedAt: number | null; startedAt: number | null; id: number },
): number {
  const aTime = a.completedAt ?? a.startedAt ?? 0;
  const bTime = b.completedAt ?? b.startedAt ?? 0;
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

  const allEntrants = await fetchEventEntrantsDetailed(eventSlug);
  const identityCandidates = buildEventEntrantIdentityCandidates(eventSlug, watchEventId, allEntrants);
  const matches = resolveStartggEntrantIdentities(playersNeedingMapping, identityCandidates);
  const matchByPlayerId = new Map(matches.map((match) => [match.watchPlayerId, match]));

  for (const player of playersNeedingMapping) {
    const entrant = matchByPlayerId.get(player.id) ?? null;

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

  const formalSets = playerSets
    .filter((set) => Number.isInteger(set.id))
    .sort(compareSetRecency);
  const latestSet = formalSets[0] ?? null;
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
  watchPlayerId: number,
  watchEventId: number,
): TrackedSetNode[] {
  return [...playerSets]
    .filter((set) => Number.isInteger(set.id) && set.completedAt !== null)
    .sort(compareSetChronology)
    .filter((set) => !hasStartggPushedSet(watchPlayerId, watchEventId, set.id));
}

interface EventProcessResult {
  changed: number;
  activeSetCount: number;
  summary: StartggEventSummaryInput | null;
  pendingInitialMessagePlayerIds: number[];
  pendingPlayerSetMarks: Array<{ watchPlayerId: number; setId: number }>;
  pendingEventSetIds: number[];
  finalPhaseTrackingPending: boolean;
}

const FINAL_PHASE_STATES = new Set(['READY', 'ACTIVE', 'COMPLETED']);

function selectFinalPhase(phases: Array<{
  id: number;
  name: string;
  phaseOrder: number;
  numSeeds: number | null;
  state: string;
}>): { id: number; name: string; numSeeds: number } | null {
  const phase = phases
    .filter((item) => item.numSeeds !== null
      && item.numSeeds >= 2
      && item.numSeeds <= 8
      && FINAL_PHASE_STATES.has(item.state))
    .sort((a, b) => b.phaseOrder - a.phaseOrder)[0];
  return phase?.numSeeds === null || !phase
    ? null
    : { id: phase.id, name: phase.name, numSeeds: phase.numSeeds };
}

async function processEvent(
  eventRow: StartggWatchEvent,
  players: StartggWatchPlayer[],
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

  const playerUpdates: StartggPlayerUpdateItem[] = [];
  const finalPhaseSetResults: StartggFinalPhaseSetResultItem[] = [];
  const pendingInitialMessagePlayerIds: number[] = [];
  const pendingPlayerSetMarks: Array<{ watchPlayerId: number; setId: number }> = [];
  const pendingPlayerSetIds = new Set<number>();
  const pendingEventSetIds: number[] = [];
  let finalPhaseStarted: StartggFinalPhaseStartedItem | null = null;
  let finalStandings: StartggFinalStandingsItem | null = null;
  let finalPhaseTrackingPending = false;

  const entrantMappings = await ensureEventEntrantMappings(
    normalizedSlug,
    eventRow.id,
    players,
    refreshEntrantMappings,
  );

  const mappedEntrantIds = Array.from(entrantMappings.values()).filter((id): id is number => id !== null);
  const featuredEntrants = listEventFeaturedEntrants(eventRow.id);
  const featuredEntrantIds = featuredEntrants.map((fe) => fe.entrant_id);
  const allEntrantIds = [...new Set([...mappedEntrantIds, ...featuredEntrantIds])];
  const [entrantSets, eventStandings] = await Promise.all([
    allEntrantIds.length > 0
      ? fetchEventSetsByEntrants(normalizedSlug, allEntrantIds)
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
    const setsToPush = selectSetsToPush(playerSets, player.id, eventRow.id);
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

      for (const set of playerSets.filter(
        (item) => Number.isInteger(item.id) && item.completedAt !== null,
      )) {
        markStartggPushedSet(player.id, eventRow.id, set.id);
      }

      changed += 1;
      playerUpdates.push({
        playerName: eventPlayerName,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: snapshot.lastSetRoundLabel,
        scoreText: snapshot.lastSetScoreText,
        setPageUrl: snapshot.setPageUrl,
      });
      pendingInitialMessagePlayerIds.push(player.id);
      continue;
    }

    if (setsToPush.length === 0) continue;

    for (const set of setsToPush) {
      changed += 1;
      const setPageUrl = `https://www.start.gg/${normalizedSlug}/set/${set.id}`;
      playerUpdates.push({
        playerName: eventPlayerName,
        status: snapshot.status,
        placement: snapshot.placement,
        roundLabel: set.fullRoundText,
        scoreText: buildSetScoreText(set.displayScore),
        setPageUrl,
      });
      pendingPlayerSetMarks.push({ watchPlayerId: player.id, setId: set.id });
      pendingPlayerSetIds.add(set.id);
    }
  }

  const featuredSetResults: StartggFeaturedSetResultItem[] = [];
  if (featuredEntrants.length > 0) {
    const featuredIdSet = new Set(featuredEntrantIds);
    const mappedIdSet = new Set(mappedEntrantIds);

    const featuredOnlySets = entrantSets.filter((set) =>
      set.slots.some((slot) => slot.entrant && featuredIdSet.has(slot.entrant.id)) &&
      !set.slots.some((slot) => slot.entrant && mappedIdSet.has(slot.entrant.id)),
    );

    const featuredActiveCount = featuredOnlySets.filter((set) =>
      set.startedAt !== null && set.completedAt === null,
    ).length;
    if (featuredActiveCount > 0) {
      activeSetCount += featuredActiveCount;
    }

    const featuredCompletedSets = featuredOnlySets
      .filter((set) => set.completedAt !== null && Number.isInteger(set.id))
      .sort(compareSetChronology);

    for (const set of featuredCompletedSets) {
      if (pendingPlayerSetIds.has(set.id)) continue;
      if (hasAnyStartggPlayerPushedSet(eventRow.id, set.id)) continue;
      if (hasStartggEventPushedSet(eventRow.id, set.id)) continue;

      const entrants = set.slots
        .map((slot) => slot.entrant)
        .filter((entrant): entrant is { id: number; name: string } => Boolean(entrant?.name));
      const winner = entrants.find((entrant) => entrant.id === set.winnerId);
      if (!winner) {
        throw new Error(`start.gg completed featured set missing winner entrant: ${set.id}`);
      }

      featuredSetResults.push({
        roundLabel: set.fullRoundText,
        entrantNames: entrants.map((entrant) => entrant.name),
        scoreText: buildSetScoreText(set.displayScore),
        winnerName: winner.name,
        setUrl: `https://www.start.gg/${normalizedSlug}/set/${set.id}`,
      });
      pendingEventSetIds.push(set.id);
      changed += 1;
    }
  }

  let finalPhaseId = eventRow.final_phase_id;
  let finalPhaseName = eventRow.final_phase_name;
  let finalPhaseNumSeeds = eventRow.final_phase_num_seeds;
  let eventState = eventRow.event_state;
  let phaseTracking: Awaited<ReturnType<typeof fetchPhaseTracking>> | null = null;

  if (refreshEventMeta) {
    const phaseMeta = await fetchEventFinalPhaseMeta(normalizedSlug);
    if (!phaseMeta) {
      throw new Error(`start.gg event phase metadata missing: ${normalizedSlug}`);
    }
    eventState = phaseMeta.state;
    const discoveredPhase = finalPhaseId === null ? selectFinalPhase(phaseMeta.phases) : null;
    updateStartggWatchEventFinalPhase({
      eventRowId: eventRow.id,
      eventState,
      phaseId: discoveredPhase?.id ?? null,
      phaseName: discoveredPhase?.name ?? null,
      phaseNumSeeds: discoveredPhase?.numSeeds ?? null,
    });

    if (discoveredPhase) {
      finalPhaseId = discoveredPhase.id;
      finalPhaseName = discoveredPhase.name;
      finalPhaseNumSeeds = discoveredPhase.numSeeds;
      const [seeds, baselineTracking] = await Promise.all([
        fetchPhaseSeeds(discoveredPhase.id),
        fetchPhaseTracking(discoveredPhase.id),
      ]);
      phaseTracking = baselineTracking;
      eventState = baselineTracking.eventState;
      for (const set of baselineTracking.sets.filter(
        (item) => item.completedAt !== null && Number.isInteger(item.id),
      )) {
        markStartggEventPushedSet(eventRow.id, set.id);
      }
      const entrants = seeds
        .filter((seed): seed is { seedNum: number; entrant: { id: number; name: string } } => seed.entrant !== null)
        .sort((a, b) => a.seedNum - b.seedNum)
        .map((seed) => ({ seedNum: seed.seedNum, name: seed.entrant.name }));
      if (eventState !== 'COMPLETED') {
        finalPhaseStarted = {
          phaseName: discoveredPhase.name,
          entrants,
        };
        changed += 1;
      }
    }
  }

  if (finalPhaseId !== null && finalPhaseName && finalPhaseNumSeeds !== null) {
    phaseTracking ??= await fetchPhaseTracking(finalPhaseId);
    eventState = phaseTracking.eventState;
    const phaseSets = phaseTracking.sets;
    const activePhaseSetCount = phaseSets.filter((set) => set.startedAt !== null && set.completedAt === null).length;
    const phaseStartedFlag = phaseSets.some((set) => set.startedAt !== null);
    if (phaseStartedFlag && eventState !== 'COMPLETED') {
      activeSetCount += Math.max(1, activePhaseSetCount);
    }

    const completedSets = phaseSets
      .filter((set) => set.completedAt !== null && Number.isInteger(set.id))
      .sort(compareSetChronology);
    for (const set of completedSets) {
      if (hasStartggEventPushedSet(eventRow.id, set.id)) continue;
      if (pendingEventSetIds.includes(set.id)) continue;
      const playerSetAlreadyPushed = hasAnyStartggPlayerPushedSet(eventRow.id, set.id)
        || pendingPlayerSetIds.has(set.id);
      if (!playerSetAlreadyPushed) {
        const entrants = set.slots
          .map((slot) => slot.entrant)
          .filter((entrant): entrant is { id: number; name: string } => Boolean(entrant?.name));
        const winner = entrants.find((entrant) => entrant.id === set.winnerId);
        if (!winner) {
          throw new Error(`start.gg completed final phase set missing winner entrant: ${set.id}`);
        }
        finalPhaseSetResults.push({
          phaseName: finalPhaseName,
          roundLabel: set.fullRoundText,
          entrantNames: entrants.map((entrant) => entrant.name),
          scoreText: buildSetScoreText(set.displayScore),
          winnerName: winner.name,
          setUrl: `https://www.start.gg/${normalizedSlug}/set/${set.id}`,
        });
        changed += 1;
      }
      if (pendingPlayerSetIds.has(set.id) || !playerSetAlreadyPushed) {
        pendingEventSetIds.push(set.id);
      } else {
        markStartggEventPushedSet(eventRow.id, set.id);
      }
    }

    if (eventState === 'COMPLETED' && eventRow.final_phase_tracking_completed === 0) {
      const standings = (await fetchEventStandings(normalizedSlug))
        .filter((standing) => standing.placement <= 8 && standing.entrant?.name)
        .map((standing) => ({
          placement: standing.placement,
          entrantName: standing.entrant!.name!,
        }));
      if (standings.length === 0) {
        throw new Error(`start.gg completed event missing final standings: ${normalizedSlug}`);
      }
      finalStandings = { standings };
      finalPhaseTrackingPending = true;
      changed += 1;
    }
  }

  const summary: StartggEventSummaryInput | null
    = playerUpdates.length > 0 || featuredSetResults.length > 0 || finalPhaseStarted !== null || finalPhaseSetResults.length > 0 || finalStandings !== null
      ? {
          tournamentName,
          eventName: eventDisplayName,
          eventSlug: resolvedEventSlug,
          playerUpdates,
          featuredSetResults,
          finalPhaseStarted,
          finalPhaseSetResults,
          finalStandings,
        }
      : null;

  return {
    changed,
    activeSetCount,
    summary,
    pendingInitialMessagePlayerIds,
    pendingPlayerSetMarks,
    pendingEventSetIds,
    finalPhaseTrackingPending,
  };
}

async function sendStartggEventSummary(
  bot: Telegraf | undefined,
  eventRowId: number,
  result: EventProcessResult,
): Promise<void> {
  if (!result.summary) return;
  const messages = buildStartggEventSummaryMessages(result.summary);
  for (const message of messages) {
    const messageId = await sendTelegramMessageWithId(message, bot);
    recordStartggSentMessage(messageId);
  }
  for (const playerId of result.pendingInitialMessagePlayerIds) {
    markStartggInitialMessageSent(playerId, eventRowId);
  }
  for (const mark of result.pendingPlayerSetMarks) {
    markStartggPushedSet(mark.watchPlayerId, eventRowId, mark.setId);
  }
  for (const setId of result.pendingEventSetIds) {
    markStartggEventPushedSet(eventRowId, setId);
  }
  if (result.finalPhaseTrackingPending) {
    markStartggFinalPhaseTrackingCompleted(eventRowId);
  }
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
      options?.refreshEntrantMappings !== false,
      options?.refreshEventMeta !== false,
    )),
  );

  let changed = 0;
  let activeSetCount = 0;
  const activeEventSlugs: string[] = [];
  for (const [index, result] of results.entries()) {
    changed += result.changed;
    activeSetCount += result.activeSetCount;
    if (result.activeSetCount > 0) {
      activeEventSlugs.push(normalizeEventSlug(targetEvents[index]!.event_slug));
    }
    if (result.summary) {
      await sendStartggEventSummary(bot, targetEvents[index]!.id, result);
    }
  }

  return {
    checkedPlayers: players.length,
    checkedEvents: targetEvents.length,
    changed,
    activeSetCount,
    activeEventSlugs,
  };
}
