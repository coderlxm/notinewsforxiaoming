<script setup lang="ts">
import { MasonryGrid } from '@egjs/grid';
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import type { JournalEntry, JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';

const props = defineProps<{
  entries: readonly JournalEntry[];
  mode: 'public' | 'private';
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  openArticle: [entry: JournalEntry];
  viewDetail: [publicId: string];
  selectTag: [tag: string];
  editArticle: [id: number];
  saveContent: [entry: JournalEntry, contentText: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const gridElement = useTemplateRef<HTMLDivElement>('grid');
const layoutReady = shallowRef(false);

let masonry: MasonryGrid;
let stopWatchingEntries: () => void;
let animateNextMountedBatch = false;
let needsActivationLayout = false;

function isArticleEntry(entry: JournalEntry): boolean {
  return entry.bodyFormat === 'rich';
}

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
}

function forwardPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}

onMounted(() => {
  masonry = new MasonryGrid(gridElement.value!, {
    align: 'start',
    gap: 0,
    useTransform: true,
    useResizeObserver: true,
    observeChildren: true,
  });

  masonry.on('renderComplete', ({ mounted }) => {
    layoutReady.value = true;

    if (!animateNextMountedBatch) return;
    animateNextMountedBatch = false;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    mounted.forEach((item, index) => {
      const card = item.element!.firstElementChild as HTMLElement;

      card.animate(
        [
          { opacity: 0, transform: 'translateY(14px) scale(0.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        {
          duration: 260,
          delay: Math.min(index, 6) * 35,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'backwards',
        },
      );
    });
  });

  masonry.renderItems();

  stopWatchingEntries = watch(
    () => props.entries,
    (entries, previousEntries) => {
      animateNextMountedBatch =
        entries.length > previousEntries.length
        && previousEntries.every((entry, index) => entry.id === entries[index]?.id);

      masonry.syncElements({ direction: 'end' });
    },
    { flush: 'post' },
  );
});

onDeactivated(() => {
  needsActivationLayout = true;
});

onActivated(() => {
  if (!needsActivationLayout) return;
  needsActivationLayout = false;
  masonry.renderItems({ useResize: true });
});

onBeforeUnmount(() => {
  stopWatchingEntries();
  masonry.destroy();
});
</script>

<template>
  <div class="waterfall-stage">
    <div v-if="!layoutReady && entries.length" class="waterfall__loading" role="status">正在读取记录…</div>

    <div ref="grid" class="waterfall" :class="{ 'waterfall--ready': layoutReady }">
      <div v-for="entry in entries" :key="entry.id" class="waterfall__item">
        <div class="waterfall__card">
          <ArticleCardContent
            v-if="isArticleEntry(entry)"
            :entry="entry"
            :editable="mode === 'private'"
            :busy="mutationEntryId === entry.id"
            @open="emit('openArticle', $event)"
            @select-tag="emit('selectTag', $event)"
            @edit="emit('editArticle', $event)"
            @set-visibility="forwardVisibility"
            @set-pinned="forwardPinned"
            @delete-entry="emit('deleteEntry', $event)"
          />
          <EntryCard
            v-else
            :entry="entry"
            :editable="mode === 'private'"
            :busy="mutationEntryId === entry.id"
            @view-detail="emit('viewDetail', $event)"
            @select-tag="emit('selectTag', $event)"
            @save-content="forwardSaveContent"
            @set-visibility="forwardVisibility"
            @set-pinned="forwardPinned"
            @delete-entry="emit('deleteEntry', $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.waterfall-stage {
  display: grid;
}

.waterfall,
.waterfall__loading {
  grid-area: 1 / 1;
}

.waterfall__loading {
  padding: 3rem 1rem;
  color: var(--text-muted);
  text-align: center;
}

.waterfall {
  position: relative;
  margin-inline: calc(var(--waterfall-gap) / -2);
  visibility: hidden;
}

.waterfall--ready {
  visibility: visible;
}

.waterfall__item {
  position: absolute;
  box-sizing: border-box;
  width: 25%;
  padding: 0 calc(var(--waterfall-gap) / 2) var(--waterfall-gap);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.waterfall__item:focus-within {
  z-index: 1;
}

.waterfall__card {
  width: 100%;
}

@media (max-width: 1359px) {
  .waterfall__item {
    width: 33.333%;
  }
}

@media (max-width: 959px) {
  .waterfall__item {
    width: 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .waterfall__item {
    transition: none;
  }
}
</style>
