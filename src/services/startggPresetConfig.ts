import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const STARTGG_PRESET_PLAYERS_PATH = resolve(process.cwd(), 'data/startgg_preset_players.json');
export const STARTGG_TOURNAMENT_WINDOWS_PATH = resolve(process.cwd(), 'data/startgg_tournament_windows.json');

const ISO_WITH_OFFSET_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const STARTGG_EVENT_SLUG_PATTERN = /^tournament\/[^/]+\/event\/[^/]+$/;

const presetPlayerSchema = z.object({
  alias: z.string().min(1),
  user_url: z.string().url().optional(),
  player_id: z.number().int().positive().optional(),
  player_name: z.string().min(1).optional(),
}).superRefine((val, ctx) => {
  if (!val.user_url && !val.player_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'player requires either user_url or player_id',
    });
  }
});

const presetPlayersConfigSchema = z.object({
  players: z.array(presetPlayerSchema),
});

const tournamentEventSchema = z.object({
  event_slug: z.string().regex(STARTGG_EVENT_SLUG_PATTERN),
  event_name: z.string().min(1),
});

const tournamentWindowSchema = z.object({
  name: z.string().min(1),
  start_at: z.string().regex(ISO_WITH_OFFSET_PATTERN),
  end_at: z.string().regex(ISO_WITH_OFFSET_PATTERN),
  timezone: z.string().min(1),
  events: z.array(tournamentEventSchema).min(1),
}).superRefine((val, ctx) => {
  const start = new Date(val.start_at);
  const end = new Date(val.end_at);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'window start_at/end_at are invalid datetime',
    });
    return;
  }
  if (start.getTime() >= end.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'window start_at must be earlier than end_at',
    });
  }
});

const tournamentWindowsConfigSchema = z.object({
  windows: z.array(tournamentWindowSchema),
});

export type StartggPresetPlayer = z.infer<typeof presetPlayerSchema>;
export type StartggPresetPlayersConfig = z.infer<typeof presetPlayersConfigSchema>;
export type StartggTournamentEvent = z.infer<typeof tournamentEventSchema>;
export type StartggTournamentWindow = z.infer<typeof tournamentWindowSchema>;
export type StartggTournamentWindowsConfig = z.infer<typeof tournamentWindowsConfigSchema>;

function parseJsonFile(path: string): unknown {
  if (!existsSync(path)) {
    throw new Error(`配置文件不存在：${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as unknown;
}

export function loadStartggPresetPlayersConfig(): StartggPresetPlayersConfig {
  const parsed = parseJsonFile(STARTGG_PRESET_PLAYERS_PATH);
  return presetPlayersConfigSchema.parse(parsed);
}

export function writeStartggPresetPlayersConfig(config: StartggPresetPlayersConfig): void {
  const validated = presetPlayersConfigSchema.parse(config);
  writeFileSync(
    STARTGG_PRESET_PLAYERS_PATH,
    `${JSON.stringify(validated, null, 2)}\n`,
    'utf-8',
  );
}

export function parseStartggTournamentWindowsConfig(input: unknown): StartggTournamentWindowsConfig {
  return tournamentWindowsConfigSchema.parse(input);
}

export function loadStartggTournamentWindowsConfig(): StartggTournamentWindowsConfig {
  const parsed = parseJsonFile(STARTGG_TOURNAMENT_WINDOWS_PATH);
  return parseStartggTournamentWindowsConfig(parsed);
}

export function getActiveTournamentWindows(
  config: StartggTournamentWindowsConfig,
  now: Date,
): StartggTournamentWindow[] {
  const nowMs = now.getTime();
  return config.windows.filter((window) => {
    const start = new Date(window.start_at).getTime();
    const end = new Date(window.end_at).getTime();
    return nowMs >= start && nowMs < end;
  });
}
