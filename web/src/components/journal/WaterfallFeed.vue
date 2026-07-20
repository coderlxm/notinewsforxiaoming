<script setup lang="ts">
import { MasonryGrid } from '@egjs/grid';
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import type { JournalEntry, JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';

const props = defineProps<{
  entries: readonly JournalEntry[];
  loading: boolean;
  loadingLabel: string;
  mode: 'public' | 'private';
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  layoutReady: [];
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

const preparing = computed(() => props.loading || (!layoutReady.value && props.entries.length > 0));
const deferredLoading = useDeferredLoading(preparing);

let masonry: MasonryGrid;
let stopWatchingEntries: () => void;
let animateNextMountedBatch = false;
let needsActivationLayout = false;
let active = true;

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
    if (active) emit('layoutReady');

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
    async (entries, previousEntries) => {
      if (previousEntries.length === 0 && entries.length > 0) {
        layoutReady.value = false;
      }

      animateNextMountedBatch =
        entries.length > previousEntries.length
        && previousEntries.every((entry, index) => entry.id === entries[index]?.id);

      await nextTick();
      masonry.syncElements({ direction: 'end' });
    },
  );
});

onDeactivated(() => {
  active = false;
  needsActivationLayout = true;
});

onActivated(() => {
  active = true;
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
  <div class="waterfall-stage" :class="{ 'waterfall-stage--preparing': preparing }" :aria-busy="preparing">
    <Transition name="waterfall-loading">
      <JournalLoading
        v-if="deferredLoading.visible.value"
        variant="canvas"
        :label="loadingLabel"
      />
    </Transition>

    <div ref="grid" class="waterfall" :class="{ 'waterfall--ready': !preparing }">
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

.waterfall-stage--preparing {
  min-height: clamp(18rem, 42vh, 30rem);
}

.waterfall-stage > :deep(.journal-loading--canvas),
.waterfall {
  grid-area: 1 / 1;
}

.waterfall {
  position: relative;
  margin-inline: calc(var(--waterfall-gap) / -2);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--dur-content-enter) var(--ease-card);
}

.waterfall--ready {
  opacity: 1;
  visibility: visible;
}

.waterfall-loading-enter-active {
  transition: opacity var(--dur-loading-enter) var(--ease-card), transform var(--dur-loading-enter) var(--ease-card);
}

.waterfall-loading-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.waterfall-loading-enter-from {
  opacity: 0;
  transform: translateY(4px);
}

.waterfall-loading-leave-to {
  opacity: 0;
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
