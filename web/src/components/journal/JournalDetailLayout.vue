<script setup lang="ts">
import { computed } from 'vue';
import type { JournalAsset, JournalEntry, JournalVisibility } from '../../types';
import JournalDetailContent from './JournalDetailContent.vue';
import JournalMediaStage from './JournalMediaStage.vue';
import JournalTextPoster from './JournalTextPoster.vue';

const props = defineProps<{
  entry: JournalEntry;
  mode: 'public' | 'private';
  busy: boolean;
}>();

const emit = defineEmits<{
  selectTag: [tag: string];
  edit: [entry: JournalEntry];
  saveContent: [entry: JournalEntry, contentText: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

function isVisualAsset(asset: JournalAsset): boolean {
  if (['photo', 'video', 'video_note', 'animation'].includes(asset.kind)) return true;
  return asset.kind === 'sticker'
    && (asset.mimeType?.startsWith('image/') === true || asset.mimeType?.startsWith('video/') === true);
}

const isRich = computed(() => props.entry.bodyFormat === 'rich');
const visualAssets = computed(() => isRich.value
  ? []
  : props.entry.assets.filter(isVisualAsset));
const supplementalAssets = computed(() => isRich.value
  ? props.entry.assets.filter((asset) => asset.role === 'attachment')
  : props.entry.assets.filter((asset) => !isVisualAsset(asset)));
const hasMediaStage = computed(() => visualAssets.value.length > 0);
const hasTextPoster = computed(() => !isRich.value
  && props.entry.contentText.trim().length > 0
  && props.entry.assets.length === 0);
const hasLeadingStage = computed(() => hasMediaStage.value || hasTextPoster.value);

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
}

function forwardPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}
</script>

<template>
  <div
    class="detail-layout"
    :class="{
      'detail-layout--with-stage': hasLeadingStage,
      'detail-layout--single': !hasLeadingStage,
      'detail-layout--rich': isRich,
    }"
  >
    <JournalMediaStage v-if="hasMediaStage" :assets="visualAssets" />
    <JournalTextPoster v-else-if="hasTextPoster" :entry="entry" />
    <JournalDetailContent
      :entry="entry"
      :mode="mode"
      :busy="busy"
      :has-leading-stage="hasLeadingStage"
      :supplemental-assets="supplementalAssets"
      @select-tag="emit('selectTag', $event)"
      @edit="emit('edit', $event)"
      @save-content="forwardSaveContent"
      @set-visibility="forwardVisibility"
      @set-pinned="forwardPinned"
      @delete-entry="emit('deleteEntry', $event)"
    />
  </div>
</template>

<style scoped>
.detail-layout {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--surface-card);
}

.detail-layout--with-stage {
  display: grid;
  grid-template-columns: minmax(0, 62fr) minmax(360px, 38fr);
  overflow: hidden;
}

.detail-layout--single {
  display: grid;
  width: min(760px, 100%);
  margin: 0 auto;
  overflow: hidden;
}

.detail-layout--rich {
  width: min(960px, 100%);
}

@media (max-width: 959px) {
  .detail-layout,
  .detail-layout--with-stage,
  .detail-layout--single,
  .detail-layout--rich {
    display: flex;
    width: 100%;
    height: 100%;
    margin: 0;
    flex-direction: column;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-color: var(--border-strong) transparent;
    scrollbar-width: thin;
  }
}
</style>
