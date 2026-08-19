interface JournalVideoPoolEntry {
  video: HTMLVideoElement;
  refCount: number;
}

const pool = new Map<string, JournalVideoPoolEntry>();

export function acquireJournalVideo(src: string): HTMLVideoElement {
  const existing = pool.get(src);
  if (existing) {
    existing.refCount += 1;
    return existing.video;
  }

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = src;
  video.load();

  pool.set(src, {
    video,
    refCount: 1,
  });

  return video;
}

export function mountJournalVideo(src: string, target: HTMLElement): HTMLVideoElement {
  const video = acquireJournalVideo(src);
  if (video.parentElement !== target) {
    target.appendChild(video);
  }
  return video;
}

export function releaseJournalVideo(src: string): void {
  const entry = pool.get(src);
  if (!entry) return;

  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.video.pause();
    entry.video.remove();
    entry.video.removeAttribute('src');
    entry.video.load();
    pool.delete(src);
  }
}
