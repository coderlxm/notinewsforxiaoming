import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';

export interface FitnessStatus {
  user_profile: {
    height: number;
    weight: number;
  };
  training_state: {
    current_level: number;
    total_completed: number;
    last_workout_date: string | null;
    last_focus_area: string | null;
  };
}

export interface FitnessContext {
  status: FitnessStatus;
  focusArea: string;
  bgmStyle: string;
  bgmKeyword: string;
}

const STATUS_PATH = resolve(process.cwd(), 'data/fitness_status.json');

const DEFAULT_STATUS: FitnessStatus = {
  user_profile: {
    height: 172,
    weight: 68
  },
  training_state: {
    current_level: 1,
    total_completed: 0,
    last_workout_date: null,
    last_focus_area: null
  }
};

function chinaDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  return `${y}-${m}-${d}`;
}

function writeStatus(status: FitnessStatus): void {
  mkdirSync(dirname(STATUS_PATH), { recursive: true });
  writeFileSync(STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, 'utf-8');
}

export function readFitnessStatus(): FitnessStatus {
  if (!existsSync(STATUS_PATH)) {
    writeStatus(DEFAULT_STATUS);
    return DEFAULT_STATUS;
  }

  try {
    return JSON.parse(readFileSync(STATUS_PATH, 'utf-8')) as FitnessStatus;
  } catch (error) {
    console.warn('[fitness] failed to read fitness status, using default status:', error);
    return DEFAULT_STATUS;
  }
}

function getDefaultFocusArea(dayOfWeek: number): string {
  if (dayOfWeek === 1) return '上肢力量 + 腹部核心';
  if (dayOfWeek === 3) return '下肢稳固 + 身体协调';
  if (dayOfWeek === 6) return '全身燃脂大循环';
  return '全身燃脂';
}

function getRecoveryAwareFocusArea(dayOfWeek: number, lastFocusArea: string | null): string {
  const defaultFocus = getDefaultFocusArea(dayOfWeek);
  if (!lastFocusArea) return defaultFocus;

  if (lastFocusArea.includes('上肢') && defaultFocus.includes('上肢')) {
    return '下肢稳固 + 核心激活';
  }
  if (lastFocusArea.includes('下肢') && defaultFocus.includes('下肢')) {
    return '上肢力量 + 腹部核心';
  }
  if (lastFocusArea.includes('全身') && defaultFocus.includes('全身')) {
    return '核心控制 + 低冲击燃脂';
  }

  return defaultFocus;
}

function getWorkoutSoundtrack(dayOfWeek: number): { bgmStyle: string; bgmKeyword: string } {
  if (dayOfWeek === 1) {
    return {
      bgmStyle: 'Phonk / Industrial Rock',
      bgmKeyword: 'gym phonk industrial rock workout'
    };
  }
  if (dayOfWeek === 3) {
    return {
      bgmStyle: 'Deep House / Progressive Trance',
      bgmKeyword: 'deep house progressive trance workout'
    };
  }
  if (dayOfWeek === 6) {
    return {
      bgmStyle: 'Hardstyle / Eurodance',
      bgmKeyword: 'hardstyle eurodance cardio workout'
    };
  }
  return {
    bgmStyle: 'Upbeat Pop / Light Electronic',
    bgmKeyword: 'upbeat pop light electronic workout'
  };
}

export function getFitnessContext(dayOfWeek: number): FitnessContext {
  const status = readFitnessStatus();
  const soundtrack = getWorkoutSoundtrack(dayOfWeek);
  return {
    status,
    focusArea: getRecoveryAwareFocusArea(dayOfWeek, status.training_state.last_focus_area),
    ...soundtrack
  };
}

export function markFitnessWorkoutGenerated(status: FitnessStatus, focusArea: string): FitnessStatus {
  const totalCompleted = status.training_state.total_completed + 1;
  const nextStatus: FitnessStatus = {
    ...status,
    training_state: {
      current_level: Math.floor(totalCompleted / 3) + 1,
      total_completed: totalCompleted,
      last_workout_date: chinaDateString(),
      last_focus_area: focusArea
    }
  };
  writeStatus(nextStatus);
  return nextStatus;
}
