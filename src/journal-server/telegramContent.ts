import type { ParsedTelegramContent, TelegramAssetSource } from './types.js';

type TelegramRecord = Record<string, unknown>;

const commandPrefix = /^\/(?:note|post)(?:@[A-Za-z0-9_]+)?(?:\s+|$)/i;
const structuredKeys = [
  'entities',
  'caption_entities',
  'location',
  'venue',
  'contact',
  'poll',
  'checklist',
  'dice',
  'game',
  'story',
  'paid_media',
] as const;

function asRecord(value: unknown): TelegramRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as TelegramRecord
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullablePositiveNumber(value: unknown): number | null {
  const number = asNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function assetFromRecord(
  kind: string,
  value: unknown,
  sortOrder: number,
  overrides: Partial<TelegramAssetSource> = {},
): TelegramAssetSource | null {
  const record = asRecord(value);
  const fileId = asString(record?.file_id);
  const fileUniqueId = asString(record?.file_unique_id);
  if (!record || !fileId || !fileUniqueId) return null;

  return {
    kind,
    fileId,
    fileUniqueId,
    originalName: asString(record.file_name),
    mimeType: asString(record.mime_type),
    declaredByteSize: nullablePositiveNumber(record.file_size),
    width: nullablePositiveNumber(record.width),
    height: nullablePositiveNumber(record.height),
    duration: nullablePositiveNumber(record.duration),
    sortOrder,
    ...overrides,
  };
}

function extractPaidMedia(value: unknown, startOrder: number): TelegramAssetSource[] {
  const paidMedia = asRecord(value);
  const mediaItems = Array.isArray(paidMedia?.media) ? paidMedia.media : [];
  const assets: TelegramAssetSource[] = [];

  for (const item of mediaItems) {
    const media = asRecord(item);
    if (!media) continue;
    const photos = Array.isArray(media.photo) ? media.photo : [];
    const largestPhoto = photos.at(-1);
    const photoAsset = assetFromRecord('paid_photo', largestPhoto, startOrder + assets.length);
    if (photoAsset) assets.push(photoAsset);
    const videoAsset = assetFromRecord('paid_video', media.video, startOrder + assets.length);
    if (videoAsset) assets.push(videoAsset);
  }

  return assets;
}

function extractAssets(message: TelegramRecord): TelegramAssetSource[] {
  const assets: TelegramAssetSource[] = [];
  const add = (kind: string, value: unknown, overrides?: Partial<TelegramAssetSource>) => {
    const asset = assetFromRecord(kind, value, assets.length, overrides);
    if (asset) assets.push(asset);
  };

  const photos = Array.isArray(message.photo) ? message.photo : [];
  add('photo', photos.at(-1));
  add('video', message.video);
  add('video_note', message.video_note);
  add('animation', message.animation);
  add('voice', message.voice);
  add('audio', message.audio);
  add('document', message.document);

  const sticker = asRecord(message.sticker);
  if (sticker) {
    add('sticker', sticker);
  }

  assets.push(...extractPaidMedia(message.paid_media, assets.length));
  return assets;
}

function contentTypeFor(message: TelegramRecord): string {
  const types = [
    'photo', 'video', 'video_note', 'animation', 'voice', 'audio', 'document', 'sticker',
    'location', 'venue', 'contact', 'poll', 'checklist', 'dice', 'game', 'story', 'paid_media',
  ];
  return types.find((key) => message[key] !== undefined) ?? 'text';
}

function extractStructuredContent(message: TelegramRecord): Record<string, unknown> | null {
  const structured = Object.fromEntries(
    structuredKeys
      .filter((key) => message[key] !== undefined)
      .map((key) => [key, message[key]]),
  );
  return Object.keys(structured).length > 0 ? structured : null;
}

function extractTags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    const tag = match[1];
    if (tag) tags.add(tag);
  }
  return [...tags];
}

export function parseTelegramMessage(message: TelegramRecord): ParsedTelegramContent {
  const sourceMessageId = asNumber(message.message_id);
  const unixDate = asNumber(message.date);
  if (!Number.isInteger(sourceMessageId) || unixDate === null) {
    throw new Error('Telegram message must contain an integer message_id and date.');
  }

  const rawContent = asString(message.text) ?? asString(message.caption) ?? '';
  const contentText = rawContent.replace(commandPrefix, '');

  return {
    sourceMessageId: sourceMessageId as number,
    mediaGroupId: asString(message.media_group_id),
    contentType: contentTypeFor(message),
    contentText,
    tags: extractTags(contentText),
    structuredContent: extractStructuredContent(message),
    sourceCreatedAt: new Date(unixDate * 1000).toISOString(),
    assets: extractAssets(message),
  };
}

export function telegramMessageChatId(message: TelegramRecord): string | null {
  const chat = asRecord(message.chat);
  const id = chat?.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
}
