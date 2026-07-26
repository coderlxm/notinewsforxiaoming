import { computed, onBeforeUnmount, shallowRef } from 'vue';

const MIB = 1024 * 1024;
const MAX_ASSETS = 30;
const MAX_VIDEOS = 5;
const MAX_TOTAL_BYTES = 500 * MIB;
const MAX_IMAGE_BYTES = 40 * MIB;
const MAX_VIDEO_BYTES = 90 * MIB;
const MAX_SENDER_NAME_LENGTH = 24;
const MAX_CONTENT_TEXT_LENGTH = 2000;

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov']);
const PREVIEWABLE_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

export type ContributionMediaKind = 'photo' | 'video';
export type ContributionPreviewKind = 'image' | 'video' | null;

export interface ContributionMedia {
  id: string;
  file: File;
  kind: ContributionMediaKind | null;
  extension: string;
  objectUrl: string | null;
  previewKind: ContributionPreviewKind;
}

export interface ContributionFormPayload {
  senderName: string;
  contentText: string;
  assets: File[];
}

let nextMediaId = 0;

function extensionOf(filename: string): string {
  return filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
}

function kindOf(extension: string): ContributionMediaKind | null {
  if (IMAGE_EXTENSIONS.has(extension)) return 'photo';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  return null;
}

function createMedia(file: File): ContributionMedia {
  const extension = extensionOf(file.name);
  const kind = kindOf(extension);
  const previewKind = PREVIEWABLE_IMAGE_EXTENSIONS.has(extension)
    ? 'image'
    : kind === 'video'
      ? 'video'
      : null;

  return {
    id: `asset-${nextMediaId++}`,
    file,
    kind,
    extension,
    objectUrl: previewKind ? URL.createObjectURL(file) : null,
    previewKind,
  };
}

function releaseMedia(media: ContributionMedia): void {
  if (media.objectUrl) URL.revokeObjectURL(media.objectUrl);
}

export function useContributionForm() {
  const senderName = shallowRef('');
  const contentText = shallowRef('');
  const media = shallowRef<ContributionMedia[]>([]);

  const totalBytes = computed(() =>
    media.value.reduce((total, item) => total + item.file.size, 0),
  );
  const videoCount = computed(() =>
    media.value.filter((item) => item.kind === 'video').length,
  );
  const photoCount = computed(() =>
    media.value.filter((item) => item.kind === 'photo').length,
  );
  const hasContent = computed(() =>
    contentText.value.trim().length > 0 || media.value.length > 0,
  );
  const hasUnsentContent = computed(() =>
    senderName.value.length > 0 || contentText.value.length > 0 || media.value.length > 0,
  );

  const validationErrors = computed(() => {
    const errors: string[] = [];

    if (Array.from(senderName.value.trim()).length > MAX_SENDER_NAME_LENGTH) {
      errors.push(`称呼不能超过 ${MAX_SENDER_NAME_LENGTH} 个字符。`);
    }
    if (Array.from(contentText.value).length > MAX_CONTENT_TEXT_LENGTH) {
      errors.push(`正文不能超过 ${MAX_CONTENT_TEXT_LENGTH} 个字符。`);
    }
    if (media.value.length > MAX_ASSETS) {
      errors.push(`一次最多选择 ${MAX_ASSETS} 项素材。`);
    }
    if (videoCount.value > MAX_VIDEOS) {
      errors.push(`一次最多选择 ${MAX_VIDEOS} 段视频。`);
    }
    if (totalBytes.value > MAX_TOTAL_BYTES) {
      errors.push('全部文件总量不能超过 500 MiB。');
    }

    for (const item of media.value) {
      if (!item.kind) {
        errors.push(`${item.file.name} 不是支持的照片或视频格式。`);
        continue;
      }
      if (item.file.type && !item.file.type.startsWith(`${item.kind === 'photo' ? 'image' : 'video'}/`)) {
        errors.push(`${item.file.name} 的文件类型与扩展名不一致。`);
      }
      if (item.kind === 'photo' && item.file.size > MAX_IMAGE_BYTES) {
        errors.push(`${item.file.name} 超过了照片 40 MiB 的限制。`);
      }
      if (item.kind === 'video' && item.file.size > MAX_VIDEO_BYTES) {
        errors.push(`${item.file.name} 超过了视频 90 MiB 的限制。`);
      }
    }

    return errors;
  });

  const canSubmit = computed(() =>
    senderName.value.trim().length > 0
    && hasContent.value
    && validationErrors.value.length === 0,
  );

  function addFiles(files: File[]): void {
    media.value = [...media.value, ...files.map(createMedia)];
  }

  function removeMedia(id: string): void {
    const target = media.value.find((item) => item.id === id);
    if (!target) return;
    releaseMedia(target);
    media.value = media.value.filter((item) => item.id !== id);
  }

  function moveMedia(id: string, direction: -1 | 1): void {
    const currentIndex = media.value.findIndex((item) => item.id === id);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= media.value.length) return;

    const nextMedia = [...media.value];
    [nextMedia[currentIndex], nextMedia[nextIndex]] = [nextMedia[nextIndex], nextMedia[currentIndex]];
    media.value = nextMedia;
  }

  function payload(): ContributionFormPayload {
    return {
      senderName: senderName.value.trim(),
      contentText: contentText.value.trim(),
      assets: media.value.map((item) => item.file),
    };
  }

  onBeforeUnmount(() => {
    media.value.forEach(releaseMedia);
  });

  return {
    senderName,
    contentText,
    media,
    totalBytes,
    videoCount,
    photoCount,
    hasUnsentContent,
    validationErrors,
    canSubmit,
    addFiles,
    removeMedia,
    moveMedia,
    payload,
  };
}
