import { writeFileSync } from 'node:fs';
import {
  STARTGG_TOURNAMENT_WINDOWS_PATH,
  loadStartggTournamentWindowsConfig,
  parseStartggTournamentWindowsConfig,
  type StartggTournamentWindow,
  type StartggTournamentWindowsConfig,
} from './startggPresetConfig';

function writeTournamentWindows(config: StartggTournamentWindowsConfig): void {
  const validated = parseStartggTournamentWindowsConfig(config);
  writeFileSync(
    STARTGG_TOURNAMENT_WINDOWS_PATH,
    `${JSON.stringify(validated, null, 2)}\n`,
    'utf-8',
  );
}

export function listStartggTournamentWindows(): StartggTournamentWindow[] {
  const config = loadStartggTournamentWindowsConfig();
  return config.windows;
}

export function addStartggTournamentWindow(window: StartggTournamentWindow): void {
  const config = loadStartggTournamentWindowsConfig();
  const exists = config.windows.some((item) => item.name === window.name);
  if (exists) {
    throw new Error(`赛事窗口名称已存在：${window.name}`);
  }
  config.windows.push(window);
  writeTournamentWindows(config);
}

export function removeStartggTournamentWindow(windowName: string): void {
  const config = loadStartggTournamentWindowsConfig();
  const next = config.windows.filter((item) => item.name !== windowName);
  if (next.length === config.windows.length) {
    throw new Error(`未找到赛事窗口：${windowName}`);
  }
  writeTournamentWindows({ windows: next });
}
