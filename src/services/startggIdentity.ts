import type { StartggWatchPlayer } from './startggRepository.js';

export type StartggEntrantMatchKind = 'user' | 'player' | 'gamer_tag';

export interface StartggEntrantIdentityCandidate {
  tournamentId: number;
  participantId: number | null;
  eventId: number;
  eventName: string;
  eventSlug: string;
  entrantId: number;
  entrantName: string;
  userId: number | null;
  playerId: number | null;
  gamerTag: string | null;
}

export interface StartggResolvedEntrantMatch extends StartggEntrantIdentityCandidate {
  watchPlayerId: number;
  matchKind: StartggEntrantMatchKind;
}

interface EntrantCandidateGroup {
  candidates: StartggEntrantIdentityCandidate[];
}

export function matchesStartggGamerTag(candidateValue: string, gamerTag: string): boolean {
  const candidate = candidateValue.trim().toLowerCase();
  const expected = gamerTag.trim().toLowerCase();
  if (!candidate || !expected) return false;
  if (candidate === expected) return true;
  if (!candidate.endsWith(expected)) return false;
  const prefix = candidate.slice(0, -expected.length);
  return /[\s|｜丨/\\·•:：]$/.test(prefix);
}

function groupIdentityCandidates(
  candidates: StartggEntrantIdentityCandidate[],
): EntrantCandidateGroup[] {
  const grouped = new Map<string, StartggEntrantIdentityCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.eventId}:${candidate.entrantId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(candidate);
    } else {
      grouped.set(key, [candidate]);
    }
  }
  return Array.from(grouped.values(), (values) => ({ candidates: values }));
}

function toResolvedMatch(
  group: EntrantCandidateGroup,
  watchPlayerId: number,
  matchKind: StartggEntrantMatchKind,
): StartggResolvedEntrantMatch {
  return {
    ...group.candidates[0]!,
    watchPlayerId,
    matchKind,
  };
}

function groupParticipantCandidates(
  candidates: StartggEntrantIdentityCandidate[],
): StartggEntrantIdentityCandidate[][] {
  const grouped = new Map<string, StartggEntrantIdentityCandidate[]>();
  for (const candidate of candidates) {
    if (candidate.participantId === null) continue;
    const key = `${candidate.tournamentId}:${candidate.participantId}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(candidate);
    } else {
      grouped.set(key, [candidate]);
    }
  }
  return Array.from(grouped.values());
}

export function resolveStartggEntrantIdentities(
  players: StartggWatchPlayer[],
  candidates: StartggEntrantIdentityCandidate[],
): StartggResolvedEntrantMatch[] {
  const groups = groupIdentityCandidates(candidates);
  const participantGroups = groupParticipantCandidates(candidates);
  const resolved: StartggResolvedEntrantMatch[] = [];

  for (const player of players) {
    const matchesByEvent = new Map<number, StartggResolvedEntrantMatch>();
    const userGroups = player.user_id === null
      ? []
      : groups.filter((group) => group.candidates.some((candidate) => candidate.userId === player.user_id));
    const playerGroups = groups.filter((group) =>
      group.candidates.some((candidate) => candidate.playerId === player.player_id),
    );

    for (const [matchKind, exactGroups] of [
      ['user', userGroups],
      ['player', playerGroups],
    ] as const) {
      for (const group of exactGroups) {
        const match = toResolvedMatch(group, player.id, matchKind);
        const existing = matchesByEvent.get(match.eventId);
        if (existing && existing.entrantId !== match.entrantId) {
          throw new Error(`start.gg exact identity conflict: player ${player.id}, event ${match.eventId}`);
        }
        if (!existing) {
          matchesByEvent.set(match.eventId, match);
        }
      }
    }

    if (player.gamer_tag) {
      const gamerTagGroups = participantGroups.filter((group) => group.some((candidate) =>
        candidate.gamerTag !== null && matchesStartggGamerTag(candidate.gamerTag, player.gamer_tag!),
      ));
      if (gamerTagGroups.length === 1) {
        for (const group of groupIdentityCandidates(gamerTagGroups[0]!)) {
          const match = toResolvedMatch(group, player.id, 'gamer_tag');
          const existing = matchesByEvent.get(match.eventId);
          if (existing && existing.entrantId !== match.entrantId) {
            throw new Error(`start.gg gamerTag identity conflicts with exact identity: player ${player.id}, event ${match.eventId}`);
          }
          if (!existing) {
            matchesByEvent.set(match.eventId, match);
          }
        }
      }
    }

    resolved.push(...matchesByEvent.values());
  }

  return resolved;
}
