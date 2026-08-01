<script setup lang="ts">
import { MasonryGrid } from '@egjs/grid';
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import ArticleCardContent from '../article/ArticleCardContent.vue';
import type { JournalEntry, JournalVisibility } from '../../types';
import EntryCard from './EntryCard.vue';
import JournalWaterfallPlaceholder from './JournalWaterfallPlaceholder.vue';

const props = defineProps<{
  entries: readonly JournalEntry[];
  loading: boolean;
  mode: 'public' | 'private';
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  layoutReady: [];
  openEntry: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
  selectTag: [tag: string];
  editArticle: [id: number];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const gridElement = useTemplateRef<HTMLDivElement>('grid');
const layoutReady = shallowRef(false);
const pendingEntryIds = shallowRef<ReadonlySet<number>>(new Set());

const preparing = computed(() =>
  (props.loading && props.entries.length === 0)
  || (!layoutReady.value && props.entries.length > 0),
);

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

function forwardPublishedTime(entry: JournalEntry, sourceCreatedAt: string): void {
  emit('setPublishedTime', entry, sourceCreatedAt);
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
    if (pendingEntryIds.value.size) pendingEntryIds.value = new Set();
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
      const hasSameEntrySequence =
        entries.length === previousEntries.length
        && entries.every((entry, index) => entry.id === previousEntries[index]?.id);

      const appended =
        previousEntries.length > 0
        && entries.length > previousEntries.length
        && previousEntries.every((entry, index) => entry.id === entries[index]?.id);
      animateNextMountedBatch = appended;
      if (hasSameEntrySequence) {
        pendingEntryIds.value = new Set();
      }
      else if (appended) {
        pendingEntryIds.value = new Set(
          entries.slice(previousEntries.length).map(entry => entry.id),
        );
      }
      else {
        layoutReady.value = false;
        pendingEntryIds.value = new Set();
      }

      await nextTick();
      masonry.syncElements({ direction: 'end' });
      if (hasSameEntrySequence) masonry.updateItems(masonry.getItems(), { direction: 'end' });
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
    <Transition name="waterfall-placeholder">
      <div v-if="preparing" class="waterfall-placeholder-layer">
        <JournalWaterfallPlaceholder />
      </div>
    </Transition>

    <div
      ref="grid"
      class="waterfall"
      :class="{ 'waterfall--ready': !preparing }"
      :aria-hidden="preparing ? 'true' : undefined"
      :inert="preparing"
    >
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="waterfall__item"
        :class="{ 'waterfall__item--pending': pendingEntryIds.has(entry.id) }"
        data-grid-skip="true"
      >
        <div class="waterfall__card">
          <ArticleCardContent
            v-if="isArticleEntry(entry)"
            :entry="entry"
            :editable="mode === 'private'"
            :busy="mutationEntryId === entry.id"
            @open-entry="emit('openEntry', $event)"
            @select-tag="emit('selectTag', $event)"
            @edit="emit('editArticle', $event)"
            @set-published-time="forwardPublishedTime"
            @set-visibility="forwardVisibility"
            @set-pinned="forwardPinned"
            @delete-entry="emit('deleteEntry', $event)"
          />
          <EntryCard
            v-else
            :entry="entry"
            :editable="mode === 'private'"
            :busy="mutationEntryId === entry.id"
            @open-entry="emit('openEntry', $event)"
            @continue-draft="emit('continueDraft', $event)"
            @select-tag="emit('selectTag', $event)"
            @save-content="forwardSaveContent"
            @set-published-time="forwardPublishedTime"
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
  container-type: inline-size;
}

.waterfall-stage--preparing {
  min-height: clamp(18rem, 42vh, 30rem);
}

.waterfall-placeholder-layer,
.waterfall {
  grid-area: 1 / 1;
}

.waterfall-placeholder-layer {
  z-index: 1;
  opacity: 1;
  pointer-events: none;
}

.waterfall {
  position: relative;
  margin-inline: calc(var(--waterfall-gap) / -2);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-content-enter) var(--ease-card);
}

.waterfall--ready {
  opacity: 1;
  pointer-events: auto;
}

.waterfall:not(.waterfall--ready) :deep(.progressive-image--loaded .progressive-image__preview),
.waterfall:not(.waterfall--ready) :deep(.progressive-image--loaded .progressive-image__original) {
  animation-play-state: paused;
}

.waterfall-placeholder-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.waterfall-placeholder-leave-to {
  opacity: 0;
}

.waterfall__item {
  position: absolute;
  box-sizing: border-box;
  width: 50%;
  padding: 0 calc(var(--waterfall-gap) / 2) var(--waterfall-gap);
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
}

.waterfall__item--pending {
  visibility: hidden;
}

.waterfall__item:focus-within {
  z-index: 1;
}

.waterfall__card {
  width: 100%;
}

@container (min-width: 720px) {
  .waterfall__item {
    width: 33.333%;
  }
}

@container (min-width: 980px) {
  .waterfall__item {
    width: 25%;
  }
}

@container (min-width: 1240px) {
  .waterfall__item {
    width: 20%;
  }
}

@container (min-width: 1560px) {
  .waterfall__item {
    width: calc(100% / 6);
  }
}

@media (prefers-reduced-motion: reduce) {
  .waterfall,
  .waterfall-placeholder-leave-active {
    transition: none;
  }

  .waterfall__item {
    transition: none;
  }
}
</style>
