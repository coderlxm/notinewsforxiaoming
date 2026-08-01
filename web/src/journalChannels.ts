import type { JournalChannel, JournalPlainChannel } from './types';

export interface JournalChannelOption {
  value: JournalChannel;
  label: string;
  layout: 'waterfall' | 'article';
  description: string;
}

export interface JournalPlainChannelOption {
  value: JournalPlainChannel;
  label: string;
  description: string;
}

export const journalChannels = [
  { value: 'life', label: '生活', layout: 'waterfall', description: '日常、见闻和生活记录' },
  { value: 'article', label: '文章', layout: 'article', description: '学习和工作相关的长内容' },
  { value: 'interest', label: '兴趣', layout: 'waterfall', description: '爱好、体验和兴趣内容' },
] as const satisfies readonly JournalChannelOption[];

export const plainJournalChannels: readonly JournalPlainChannelOption[] = [
  journalChannels[0],
  journalChannels[2],
];

export function isJournalChannel(value: string): value is JournalChannel {
  return journalChannels.some(channel => channel.value === value);
}

export function publicFeedPath(channel: JournalChannel, tag = ''): string {
  const search = new URLSearchParams();
  if (channel !== 'life') search.set('channel', channel);
  if (tag) search.set('tag', tag);
  const query = search.toString();
  return query ? `/?${query}` : '/';
}
