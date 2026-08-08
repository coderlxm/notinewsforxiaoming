import { readonly, shallowRef } from 'vue';
import { fetchPrivateTablePage } from '../api';
import type { FeedFilters, JournalEntry } from '../types';

const PAGE_SIZE = 30;

export function usePrivateAssetTable() {
  const entries = shallowRef<JournalEntry[]>([]);
  const page = shallowRef(1);
  const total = shallowRef(0);
  const loading = shallowRef(false);
  const error = shallowRef<string | null>(null);

  function exposeError(reason: unknown): void {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  async function load(options: { page: number; filters: FeedFilters }): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const result = await fetchPrivateTablePage({
        page: options.page,
        pageSize: PAGE_SIZE,
        filters: options.filters,
      });
      entries.value = result.entries;
      page.value = result.page;
      total.value = result.total;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  function replaceEntry(entry: JournalEntry): void {
    entries.value = entries.value.map(item => item.id === entry.id ? entry : item);
  }

  function removeEntry(id: number): void {
    entries.value = entries.value.filter(item => item.id !== id);
  }

  function clear(): void {
    entries.value = [];
    page.value = 1;
    total.value = 0;
    loading.value = false;
    error.value = null;
  }

  return {
    entries: readonly(entries),
    page: readonly(page),
    pageSize: PAGE_SIZE,
    total: readonly(total),
    loading: readonly(loading),
    error: readonly(error),
    load,
    replaceEntry,
    removeEntry,
    clear,
  };
}
