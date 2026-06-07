import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const STARTGG_PRESET_PLAYERS_PATH = resolve(process.cwd(), 'data/startgg_preset_players.json');

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

export type StartggPresetPlayer = z.infer<typeof presetPlayerSchema>;
export type StartggPresetPlayersConfig = z.infer<typeof presetPlayersConfigSchema>;

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
