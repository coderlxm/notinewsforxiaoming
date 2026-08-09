<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type {
  JournalAsset,
  JournalEntry,
  JournalPlainChannel,
} from '../../types';
import type { AccessSettingsInput } from './accessSettings';
import JournalDetailContent from './JournalDetailContent.vue';
import JournalDetailPeek from './JournalDetailPeek.vue';
import JournalMediaStage from './JournalMediaStage.vue';
import JournalTextPoster from './JournalTextPoster.vue';

const props = defineProps<{
  entry: JournalEntry;
  mode: 'public' | 'private';
  busy: boolean;
}>();

const emit = defineEmits<{
  stageAspectRatioChange: [aspectRatio: number | null];
  selectTag: [tag: string];
  edit: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  saveAccessSettings: [entry: JournalEntry, settings: AccessSettingsInput];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
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
const layout = useTemplateRef<HTMLElement>('layout');
const content = useTemplateRef<HTMLElement>('content');
const contentBelowViewport = shallowRef(false);
const showContentPeek = computed(() => hasMediaStage.value
  && props.entry.contentText.trim().length > 0
  && contentBelowViewport.value);
let contentObserver: IntersectionObserver;

onMounted(() => {
  contentObserver = new IntersectionObserver(([entry]) => {
    contentBelowViewport.value = entry.boundingClientRect.top >= entry.rootBounds!.bottom;
  }, {
    root: layout.value!,
    rootMargin: '0px 0px -128px 0px',
    threshold: 0,
  });
  contentObserver.observe(content.value!);
});

onBeforeUnmount(() => contentObserver.disconnect());

function forwardSaveContent(entry: JournalEntry, contentText: string): void {
  emit('saveContent', entry, contentText);
}

function forwardPublishedTime(entry: JournalEntry, sourceCreatedAt: string): void {
  emit('setPublishedTime', entry, sourceCreatedAt);
}

function forwardAccessSettings(entry: JournalEntry, settings: AccessSettingsInput): void {
  emit('saveAccessSettings', entry, settings);
}

function forwardChannel(entry: JournalEntry, channel: JournalPlainChannel): void {
  emit('setChannel', entry, channel);
}

function forwardPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}
</script>

<template>
  <div
    ref="layout"
    class="detail-layout"
    :class="{
      'detail-layout--with-stage': hasLeadingStage,
      'detail-layout--single': !hasLeadingStage,
      'detail-layout--rich': isRich,
    }"
  >
    <JournalMediaStage
      v-if="hasMediaStage"
      :assets="visualAssets"
      @aspect-ratio-change="emit('stageAspectRatioChange', $event)"
    />
    <JournalTextPoster v-else-if="hasTextPoster" :entry="entry" display="detail" />
    <div ref="content" class="detail-layout__content">
      <JournalDetailContent
        :entry="entry"
        :mode="mode"
        :busy="busy"
        :has-leading-stage="hasLeadingStage"
        :has-text-poster="hasTextPoster"
        :supplemental-assets="supplementalAssets"
        @select-tag="emit('selectTag', $event)"
        @edit="emit('edit', $event)"
        @continue-draft="emit('continueDraft', $event)"
        @save-content="forwardSaveContent"
        @set-published-time="forwardPublishedTime"
        @save-access-settings="forwardAccessSettings"
        @set-channel="forwardChannel"
        @set-pinned="forwardPinned"
        @delete-entry="emit('deleteEntry', $event)"
      />
    </div>
    <Transition name="detail-peek">
      <JournalDetailPeek v-if="showContentPeek" :entry="entry" />
    </Transition>
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
  grid-template-columns:
    minmax(0, var(--detail-stage-width, 62fr))
    minmax(360px, var(--detail-content-width, 38fr));
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

.detail-layout__content {
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.detail-peek-enter-active,
.detail-peek-leave-active {
  transition:
    opacity 160ms ease,
    transform 180ms var(--ease-card);
}

.detail-peek-enter-from,
.detail-peek-leave-to {
  opacity: 0;
  transform: translateY(18px);
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

  .detail-layout__content {
    display: block;
    width: 100%;
    height: auto;
    flex: 0 0 auto;
    overflow: visible;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-peek-enter-active,
  .detail-peek-leave-active {
    transition: none;
  }
}
</style>
