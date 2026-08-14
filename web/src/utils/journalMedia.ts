import type { JournalAsset } from '../types';

export type JournalMediaType = 'image' | 'video' | 'audio' | 'file';

type JournalMediaAsset = Pick<JournalAsset, 'kind' | 'mimeType'>;
type JournalCardImageAsset = Pick<
  JournalAsset,
  'id' | 'kind' | 'mimeType' | 'url' | 'posterUrl'
>;

export function isJournalAnimatedImage(asset: JournalMediaAsset): boolean {
  return asset.kind === 'animation' && asset.mimeType?.startsWith('image/') === true;
}

export function resolveJournalCardImageSource(asset: JournalCardImageAsset): string {
  if (!isJournalAnimatedImage(asset)) return asset.url;
  if (asset.posterUrl === null) {
    throw new Error(`Animated Journal asset ${asset.id} does not have a static poster.`);
  }
  return asset.posterUrl;
}

export function resolveJournalMediaType(asset: JournalMediaAsset): JournalMediaType {
  if (
    asset.kind === 'photo'
    || isJournalAnimatedImage(asset)
    || (asset.kind === 'sticker' && asset.mimeType?.startsWith('image/') === true)
  ) {
    return 'image';
  }

  if (
    ['video', 'video_note'].includes(asset.kind)
    || (asset.kind === 'animation' && asset.mimeType?.startsWith('image/') !== true)
    || (asset.kind === 'sticker' && asset.mimeType?.startsWith('video/') === true)
  ) {
    return 'video';
  }

  if (['voice', 'audio'].includes(asset.kind)) return 'audio';
  return 'file';
}
