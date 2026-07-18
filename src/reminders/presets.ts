export interface PresetReminder {
  id: string;
  emoji: string;
  label: string;
  reminderText: string;
  minutes: number;
}

export const STARTGG_GO_SHORTCUT = {
  emoji: '👊',
  label: '比赛了',
} as const;

export const PRESET_REMINDERS: PresetReminder[] = [
  { id: 'noodles',  emoji: '🍜', label: '吃泡面',   reminderText: '吃泡面', minutes: 7  },
  { id: 'pomodoro', emoji: '🍅', label: '番茄钟',   reminderText: '番茄钟结束', minutes: 25 },
  { id: 'laundry',  emoji: '👕', label: '收衣服',   reminderText: '收衣服', minutes: 60 },
  { id: 'water',    emoji: '🍵', label: '喝水',     reminderText: '喝水', minutes: 30 },
  { id: 'workout',  emoji: '🏋️', label: '健身',     reminderText: '健身时间', minutes: 60 },
  { id: 'nap',      emoji: '⏰', label: '小睡一下',  reminderText: '小睡结束', minutes: 20 },
];

const LABEL_MAP = new Map(PRESET_REMINDERS.map(p => [`${p.emoji} ${p.label}`, p]));

export function findPresetByText(text: string): PresetReminder | undefined {
  return LABEL_MAP.get(text.trim());
}
