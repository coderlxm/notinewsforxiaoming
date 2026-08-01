<script setup lang="ts">
import { computed, onMounted, onUpdated } from 'vue';
import type { JournalEntry } from '../../types';
import ArticleCardContent from './ArticleCardContent.vue';
import JournalArticleFeedPlaceholder from './JournalArticleFeedPlaceholder.vue';

const props = defineProps<{
  entries: readonly JournalEntry[];
  loading: boolean;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalEntry];
  selectTag: [tag: string];
}>();

const preparing = computed(() => props.loading && props.entries.length === 0);

onMounted(() => {
  if (!preparing.value) emit('layoutReady');
});
onUpdated(() => {
  if (!preparing.value) emit('layoutReady');
});
</script>

<template>
  <div class="article-feed" :aria-busy="preparing">
    <JournalArticleFeedPlaceholder v-if="preparing" />
    <div v-else class="article-feed__grid">
      <ArticleCardContent
        v-for="entry in entries"
        :key="entry.id"
        :entry="entry"
        @open-entry="emit('openEntry', $event)"
        @select-tag="emit('selectTag', $event)"
      />
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
