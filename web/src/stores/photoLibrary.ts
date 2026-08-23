import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchPhotoAlbum, fetchPhotoLibrary } from '../api';
import type {
  PhotoAlbumDetail,
  PhotoLibraryOverview,
} from '../../../src/shared/photoLibraryProtocol';

export const usePhotoLibraryStore = defineStore('photoLibrary', () => {
  const overview = shallowRef<PhotoLibraryOverview | null>(null);
  const overviewLoading = shallowRef(false);
  const overviewError = shallowRef<string | null>(null);
  const albumsById = shallowRef(new Map<string, PhotoAlbumDetail>());
  const albumLoadingIds = shallowRef(new Set<string>());
  const albumErrorsById = shallowRef(new Map<string, string>());

  let pendingOverview: Promise<void> | null = null;
  const pendingAlbums = new Map<string, Promise<void>>();

  function errorMessage(reason: unknown): string {
    return reason instanceof Error ? reason.message : String(reason);
  }

  async function loadOverview(): Promise<void> {
    overviewLoading.value = true;
    overviewError.value = null;
    try {
      overview.value = await fetchPhotoLibrary();
    }
    catch (reason) {
      overviewError.value = errorMessage(reason);
    }
    finally {
      overviewLoading.value = false;
    }
  }

  async function ensureOverview(): Promise<void> {
    if (overview.value !== null || overviewError.value !== null) return;
    if (pendingOverview !== null) return await pendingOverview;

    pendingOverview = loadOverview();
    try {
      await pendingOverview;
    }
    finally {
      pendingOverview = null;
    }
  }

  function markAlbumLoading(albumId: string, loading: boolean): void {
    const next = new Set(albumLoadingIds.value);
    if (loading) next.add(albumId);
    else next.delete(albumId);
    albumLoadingIds.value = next;
  }

  function setAlbumError(albumId: string, message: string | null): void {
    const next = new Map(albumErrorsById.value);
    if (message === null) next.delete(albumId);
    else next.set(albumId, message);
    albumErrorsById.value = next;
  }

  async function loadAlbum(albumId: string): Promise<void> {
    markAlbumLoading(albumId, true);
    setAlbumError(albumId, null);
    try {
      const detail = await fetchPhotoAlbum(albumId);
      const next = new Map(albumsById.value);
      next.set(albumId, detail);
      albumsById.value = next;
    }
    catch (reason) {
      setAlbumError(albumId, errorMessage(reason));
    }
    finally {
      markAlbumLoading(albumId, false);
    }
  }

  async function ensureAlbum(albumId: string): Promise<void> {
    if (albumsById.value.has(albumId) || albumErrorsById.value.has(albumId)) return;

    const pending = pendingAlbums.get(albumId);
    if (pending) return await pending;

    const request = loadAlbum(albumId);
    pendingAlbums.set(albumId, request);
    try {
      await request;
    }
    finally {
      pendingAlbums.delete(albumId);
    }
  }

  return {
    overview,
    overviewLoading,
    overviewError,
    albumsById,
    albumLoadingIds,
    albumErrorsById,
    ensureOverview,
    ensureAlbum,
  };
});
