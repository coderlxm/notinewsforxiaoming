<script setup lang="ts">
import { List } from 'vant';
import PublicArticleFeed from '../../article/PublicArticleFeed.vue';
import type { PublicJournalFeedItem } from '../../../types';
import JournalLoading from '../../ui/JournalLoading.vue';
import WaterfallFeed from '../WaterfallFeed.vue';

defineProps<{
  entries: readonly PublicJournalFeedItem[];
  loading: boolean;
  loadingMore: boolean;
  finished: boolean;
  disabled: boolean;
  layout: 'article' | 'waterfall';
  initialLoading: boolean;
  error: string | null;
  initialTag: string;
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  load: [];
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  selectTag: [tag: string];
}>();
</script>

<template>
  <div class="feed__entries">
    <List
      class="feed__infinite-list"
      :loading="loadingMore"
      :finished="finished"
      :disabled="disabled"
      :immediate-check="false"
      :offset="320"
      @load="emit('load')"
    >
      <PublicArticleFeed
        v-if="layout === 'article'"
        :entries="entries"
        :loading="loading"
        @layout-ready="emit('layoutReady')"
        @open-entry="emit('openEntry', $event)"
        @select-tag="emit('selectTag', $event)"
      />
      <WaterfallFeed
        v-else
        :entries="entries"
        :loading="loading"
        mode="public"
        :mutation-entry-id="mutationEntryId"
        @layout-ready="emit('layoutReady')"
        @open-entry="emit('openEntry', $event)"
        @select-tag="emit('selectTag', $event)"
      />

      <p
        v-if="!initialLoading && !entries.length && !error"
        class="feed__empty"
      >
        {{ initialTag
            ? '这个标签下还没有公开内容。'
            : '这里还没有公开记录。' }}
      </p>

      <template #loading>
        <div v-if="loadingMore" class="feed__pagination-loading">
          <JournalLoading variant="inline" label="正在读取更早记录…" />
        </div>
      </template>

      <template #finished>
        <p
          v-if="!loadingMore && !error && entries.length"
          class="feed__pagination-finished"
        >
          {{ layout === 'article' ? '已经看到全部文章' : '已经看到全部记录' }}
        </p>
      </template>
    </List>
  </div>
</template>

<style scoped>
.feed__entries {
  display: grid;
  gap: 0.75rem;
}

.feed__infinite-list {
  display: grid;
  gap: 0.75rem;
}

.feed__empty {
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
}

.feed__pagination-loading,
.feed__pagination-finished {
  margin: 0;
  padding: 0.75rem 1rem 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}
</style>
