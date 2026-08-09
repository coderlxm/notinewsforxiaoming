<script setup lang="ts">
import { computed, onActivated, onMounted, onUpdated } from 'vue';
import {
  isProtectedJournalEntry,
  type PublicJournalFeedItem,
} from '../../types';
import ProtectedEntryCard from '../journal/ProtectedEntryCard.vue';
import ArticleCardContent from './ArticleCardContent.vue';
import JournalArticleFeedPlaceholder from './JournalArticleFeedPlaceholder.vue';

const props = defineProps<{
  entries: readonly PublicJournalFeedItem[];
  loading: boolean;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: PublicJournalFeedItem];
  selectTag: [tag: string];
}>();

const preparing = computed(() => props.loading && props.entries.length === 0);

function entryKey(entry: PublicJournalFeedItem): string {
  return isProtectedJournalEntry(entry) ? `protected:${entry.publicId}` : `entry:${entry.id}`;
}

onMounted(() => {
  if (!preparing.value) emit('layoutReady');
});
onUpdated(() => {
  if (!preparing.value) emit('layoutReady');
});
onActivated(() => {
  if (!preparing.value) emit('layoutReady');
});
</script>

<template>
  <div class="article-feed" :aria-busy="preparing">
    <JournalArticleFeedPlaceholder v-if="preparing" />
    <div v-else class="article-feed__grid">
      <template v-for="entry in entries" :key="entryKey(entry)">
        <ProtectedEntryCard
          v-if="isProtectedJournalEntry(entry)"
          :entry="entry"
          display="article"
          @open="emit('openEntry', $event)"
        />
        <ProtectedEntryCard
          v-else-if="entry.visibility === 'protected'"
          :entry="entry"
          display="article"
          @open="emit('openEntry', $event)"
        />
        <ArticleCardContent
          v-else
          :entry="entry"
          show-year
          @open-entry="emit('openEntry', $event)"
          @select-tag="emit('selectTag', $event)"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.article-feed,
.article-feed__grid {
  min-width: 0;
}

.article-feed__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: var(--waterfall-gap);
}

@media (max-width: 1199px) {
  .article-feed__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 599px) {
  .article-feed__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
