<script setup lang="ts">
import { MasonryGrid } from '@egjs/grid';
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, onUpdated, shallowRef, useTemplateRef } from 'vue';
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

const gridElement = useTemplateRef<HTMLDivElement>('grid');
const laidOutEntryKeys = shallowRef<readonly string[]>([]);

let masonry: MasonryGrid;
let needsActivationLayout = false;
let active = true;
let previousEntries = props.entries;
let previousLoading = props.loading;

function entryKey(entry: PublicJournalFeedItem): string {
  return isProtectedJournalEntry(entry) ? `protected:${entry.publicId}` : `entry:${entry.id}`;
}

function sameEntryAt(
  entry: PublicJournalFeedItem,
  entries: readonly PublicJournalFeedItem[],
  index: number,
): boolean {
  const comparedEntry = entries[index];
  return comparedEntry !== undefined && entryKey(entry) === entryKey(comparedEntry);
}

const entryKeys = computed(() => props.entries.map(entryKey));
const hasCurrentLayout = computed(() =>
  entryKeys.value.length === laidOutEntryKeys.value.length
  && entryKeys.value.every((key, index) => key === laidOutEntryKeys.value[index]),
);
const appendedToCurrentLayout = computed(() =>
  laidOutEntryKeys.value.length > 0
  && entryKeys.value.length > laidOutEntryKeys.value.length
  && laidOutEntryKeys.value.every((key, index) => key === entryKeys.value[index]),
);
const pendingEntryIds = computed<ReadonlySet<string>>(() =>
  appendedToCurrentLayout.value
    ? new Set(entryKeys.value.slice(laidOutEntryKeys.value.length))
    : new Set(),
);
const preparing = computed(() =>
  (props.loading && props.entries.length === 0)
  || (props.entries.length > 0 && !hasCurrentLayout.value && !appendedToCurrentLayout.value),
);

onMounted(() => {
  masonry = new MasonryGrid(gridElement.value!, {
    align: 'start',
    gap: 0,
    useTransform: true,
    useResizeObserver: true,
    observeChildren: true,
  });

  masonry.on('renderComplete', () => {
    if (!hasCurrentLayout.value) laidOutEntryKeys.value = entryKeys.value;
    if (active) emit('layoutReady');
  });

  masonry.renderItems();
  if (!props.loading && props.entries.length === 0) emit('layoutReady');
});

onUpdated(() => {
  const entriesChanged = props.entries !== previousEntries;
  const loadingCompleted = previousLoading && !props.loading;
  const hasSameEntrySequence =
    props.entries.length === previousEntries.length
    && props.entries.every((entry, index) => sameEntryAt(entry, previousEntries, index));

  previousEntries = props.entries;
  previousLoading = props.loading;

  if (entriesChanged) {
    masonry.syncElements({ direction: 'end' });
    if (hasSameEntrySequence) masonry.updateItems(masonry.getItems(), { direction: 'end' });
  }

  if (active && !props.loading && props.entries.length === 0 && (entriesChanged || loadingCompleted)) {
    emit('layoutReady');
  }
});

onDeactivated(() => {
  active = false;
  needsActivationLayout = true;
});

onActivated(() => {
  active = true;
  if (!needsActivationLayout) return;
  needsActivationLayout = false;
  if (!props.loading && props.entries.length === 0) {
    emit('layoutReady');
    return;
  }
  masonry.renderItems({ useResize: true });
});

onBeforeUnmount(() => {
  masonry.destroy();
});
</script>

<template>
  <div class="article-feed" :class="{ 'article-feed--preparing': preparing }" :aria-busy="preparing">
    <div v-if="preparing" class="article-feed__placeholder">
      <JournalArticleFeedPlaceholder />
    </div>

    <div
      ref="grid"
      class="article-feed__grid"
      :class="{ 'article-feed__grid--ready': !preparing }"
      :aria-hidden="preparing ? 'true' : undefined"
      :inert="preparing"
    >
      <div
        v-for="entry in entries"
        :key="entryKey(entry)"
        class="article-feed__item"
        :class="{ 'article-feed__item--pending': pendingEntryIds.has(entryKey(entry)) }"
        data-grid-skip="true"
      >
        <div class="article-feed__card">
          <ProtectedEntryCard
            v-if="isProtectedJournalEntry(entry)"
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
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.article-feed {
  display: grid;
  min-width: 0;
  container-type: inline-size;
}

.article-feed--preparing {
  min-height: clamp(18rem, 42vh, 30rem);
}

.article-feed__placeholder,
.article-feed__grid {
  grid-area: 1 / 1;
}

.article-feed__placeholder {
  z-index: 1;
  pointer-events: none;
}

.article-feed__grid {
  position: relative;
  min-width: 0;
  margin-inline: calc(var(--waterfall-gap) / -2);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-content-enter) var(--ease-card);
}

.article-feed__grid--ready {
  opacity: 1;
  pointer-events: auto;
}

.article-feed__item {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  padding: 0 calc(var(--waterfall-gap) / 2) var(--waterfall-gap);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.article-feed__item--pending {
  visibility: hidden;
}

.article-feed__item:focus-within {
  z-index: 1;
}

.article-feed__card {
  width: 100%;
}

@container (min-width: 600px) {
  .article-feed__item {
    width: 50%;
  }
}

@container (min-width: 1200px) {
  .article-feed__item {
    width: 33.333%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-feed__grid,
  .article-feed__item {
    transition: none;
  }
}
</style>
