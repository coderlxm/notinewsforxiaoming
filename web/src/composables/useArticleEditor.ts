import { readonly, shallowRef } from 'vue';
import {
  createArticle as createArticleRequest,
  deleteArticleAsset as deleteArticleAssetRequest,
  fetchArticle,
  updateArticle as updateArticleRequest,
  updateEntryVisibility,
  uploadArticleAsset as uploadArticleAssetRequest,
} from '../api';
import type {
  JournalArticleAssetResponse,
  JournalEntry,
  JournalRichDocument,
  JournalVisibility,
} from '../types';

export function useArticleEditor() {
  const article = shallowRef<JournalEntry | null>(null);
  const loading = shallowRef(false);
  const saving = shallowRef(false);
  const uploading = shallowRef(false);
  const error = shallowRef<string | null>(null);

  function exposeError(reason: unknown): void {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  async function load(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      article.value = await fetchArticle(id);
    } catch (reason) {
      exposeError(reason);
    } finally {
      loading.value = false;
    }
  }

  async function create(input: {
    title: string;
    richBody: JournalRichDocument;
    tags: string[];
    aiGenerated: boolean;
  }): Promise<JournalEntry | null> {
    saving.value = true;
    error.value = null;
    try {
      const created = await createArticleRequest(input);
      article.value = created;
      return created;
    } catch (reason) {
      exposeError(reason);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function save(input: {
    title: string;
    richBody: JournalRichDocument;
    tags: string[];
    aiGenerated: boolean;
  }): Promise<JournalEntry | null> {
    if (article.value === null) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await updateArticleRequest(article.value.id, input);
      article.value = updated;
      return updated;
    } catch (reason) {
      exposeError(reason);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function setVisibility(
    visibility: JournalVisibility,
    accessPassword?: string,
  ): Promise<JournalEntry | null> {
    if (article.value === null) return null;
    saving.value = true;
    error.value = null;
    try {
      const updated = await updateEntryVisibility(article.value.id, visibility, accessPassword);
      article.value = updated;
      return updated;
    } catch (reason) {
      exposeError(reason);
      return null;
    } finally {
      saving.value = false;
    }
  }

  async function uploadAsset(
    file: File,
    role: 'cover' | 'inline',
  ): Promise<JournalArticleAssetResponse | null> {
    if (article.value === null) return null;
    uploading.value = true;
    error.value = null;
    try {
      const asset = await uploadArticleAssetRequest(article.value.id, file, role);
      const refreshed = await fetchArticle(article.value.id);
      article.value = refreshed;
      return asset;
    } catch (reason) {
      exposeError(reason);
      return null;
    } finally {
      uploading.value = false;
    }
  }

  async function removeAsset(assetId: number): Promise<void> {
    if (article.value === null) return;
    uploading.value = true;
    error.value = null;
    try {
      await deleteArticleAssetRequest(article.value.id, assetId);
      const refreshed = await fetchArticle(article.value.id);
      article.value = refreshed;
    } catch (reason) {
      exposeError(reason);
    } finally {
      uploading.value = false;
    }
  }

  return {
    article: readonly(article),
    loading: readonly(loading),
    saving: readonly(saving),
    uploading: readonly(uploading),
    error: readonly(error),
    load,
    create,
    save,
    setVisibility,
    uploadAsset,
    removeAsset,
  };
}
