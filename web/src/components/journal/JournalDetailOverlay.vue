<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { CSSProperties } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';
import type { JournalAsset, JournalEntry, JournalVisibility } from '../../types';
import JournalDetailLayout from './JournalDetailLayout.vue';

const props = defineProps<{
  entry?: JournalEntry;
  mode: 'public' | 'private';
  busy: boolean;
  loading?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  close: [];
  selectTag: [tag: string];
  edit: [entry: JournalEntry];
  continueDraft: [entry: JournalEntry];
  saveContent: [entry: JournalEntry, contentText: string];
  setPublishedTime: [entry: JournalEntry, sourceCreatedAt: string];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  setPinned: [entry: JournalEntry, pinned: boolean];
  deleteEntry: [entry: JournalEntry];
}>();

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const panel = useTemplateRef<HTMLElement>('panel');
const closing = shallowRef(false);
const viewportWidth = shallowRef(window.innerWidth);
const viewportHeight = shallowRef(window.innerHeight);
const textPosterAspectRatio = 4 / 5;
const mediaControlsHeight = 130;

function isVisualAsset(asset: JournalAsset): boolean {
  if (['photo', 'video', 'video_note', 'animation'].includes(asset.kind)) return true;
  return asset.kind === 'sticker'
    && (asset.mimeType?.startsWith('image/') === true || asset.mimeType?.startsWith('video/') === true);
}

function isVideoAsset(asset: JournalAsset): boolean {
  return ['video', 'video_note'].includes(asset.kind)
    || (asset.kind === 'animation' && asset.mimeType?.startsWith('image/') !== true)
    || (asset.kind === 'sticker' && asset.mimeType?.startsWith('video/') === true);
}

function isAdaptiveImage(asset: JournalAsset): boolean {
  if (isVideoAsset(asset) || asset.kind === 'sticker' || !asset.width || !asset.height) return false;
  const ratio = asset.width / asset.height;
  return ratio >= 0.45 && ratio <= 2.2;
}

const titleId = computed(() => `journal-detail-title-${props.entry?.id ?? 'pending'}`);
const visualAssets = computed(() => props.entry?.bodyFormat === 'plain'
  ? props.entry.assets.filter(isVisualAsset)
  : []);
const hasVisualMedia = computed(() => visualAssets.value.length > 0);
const initialStageAspectRatio = computed(() => {
  const asset = visualAssets.value[0];
  return asset && isAdaptiveImage(asset) ? asset.width! / asset.height! : null;
});
const activeStageAspectRatio = shallowRef<number | null>(initialStageAspectRatio.value);
const hasTextPoster = computed(() => {
  const entry = props.entry;
  return entry?.bodyFormat === 'plain'
    && entry.contentText.trim().length > 0
    && entry.assets.length === 0;
});
const resolvedStageAspectRatio = computed(() => {
  if (hasVisualMedia.value) return activeStageAspectRatio.value;
  return hasTextPoster.value ? textPosterAspectRatio : null;
});
const overlaySizeClass = computed(() => {
  if (props.entry?.bodyFormat === 'rich') return 'detail-overlay--rich';
  return hasVisualMedia.value || hasTextPoster.value
    ? 'detail-overlay--media'
    : 'detail-overlay--compact';
});
const overlayStyle = computed<CSSProperties>(() => {
  const stageAspectRatio = resolvedStageAspectRatio.value;
  if (stageAspectRatio === null || viewportWidth.value < 960) return {};

  const maximumWidth = Math.min(1440, viewportWidth.value - 48);
  const maximumHeight = Math.min(880, viewportHeight.value - 48);
  const contentWidth = Math.min(440, Math.max(360, maximumWidth * 0.34));
  const controlsHeight = visualAssets.value.length > 1 ? mediaControlsHeight : 0;
  const stageWidth = Math.min(
    (maximumHeight - controlsHeight) * stageAspectRatio,
    maximumWidth - contentWidth,
  );
  const overlayHeight = stageWidth / stageAspectRatio + controlsHeight;

  return {
    width: `${Math.round(stageWidth + contentWidth)}px`,
    height: `${Math.round(overlayHeight)}px`,
    '--detail-stage-width': `${Math.round(stageWidth)}px`,
    '--detail-content-width': `${Math.round(contentWidth)}px`,
  };
});

onMounted(() => {
  dialog.value!.showModal();
  window.addEventListener('resize', updateViewportSize);
});
onBeforeUnmount(() => window.removeEventListener('resize', updateViewportSize));

function updateViewportSize(): void {
  viewportWidth.value = window.innerWidth;
  viewportHeight.value = window.innerHeight;
}

function updateStageAspectRatio(aspectRatio: number | null): void {
  activeStageAspectRatio.value = aspectRatio;
}

function requestClose(): void {
  if (closing.value) return;
  closing.value = true;
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value) requestClose();
}

function handlePanelTransitionEnd(event: TransitionEvent): void {
  if (
    closing.value
    && event.target === panel.value
    && event.propertyName === 'opacity'
  ) {
    dialog.value!.close();
  }
}

function handleNativeClose(): void {
  emit('close');
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
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="detail-overlay"
      :class="[overlaySizeClass, { 'detail-overlay--closing': closing }]"
      :style="overlayStyle"
      :aria-labelledby="titleId"
      aria-modal="true"
      @cancel.prevent="requestClose"
      @click="handleBackdropClick"
      @close="handleNativeClose"
    >
      <section
        ref="panel"
        class="detail-overlay__panel"
        @transitionend="handlePanelTransitionEnd"
        @transitioncancel="handlePanelTransitionEnd"
      >
        <h2 :id="titleId" class="detail-overlay__title">
          {{ entry?.title ?? '记录详情' }}
        </h2>
        <p v-if="entry && error" class="detail-overlay__error notice notice--error" role="alert">
          {{ error }}
        </p>
        <button
          class="detail-overlay__close"
          type="button"
          aria-label="关闭详情"
          autofocus
          @click="requestClose"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <JournalDetailLayout
          v-if="entry"
          :entry="entry"
          :mode="mode"
          :busy="busy"
          @stage-aspect-ratio-change="updateStageAspectRatio"
          @select-tag="emit('selectTag', $event)"
          @edit="emit('edit', $event)"
          @continue-draft="emit('continueDraft', $event)"
          @save-content="forwardSaveContent"
          @set-published-time="forwardPublishedTime"
          @set-visibility="forwardVisibility"
          @set-pinned="forwardPinned"
          @delete-entry="emit('deleteEntry', $event)"
        />
        <div v-else class="detail-overlay__reading-stage" :aria-busy="loading">
          <JournalLoading v-if="loading && !error" variant="reading" label="正在展开记录…" />
          <p v-else-if="error" class="notice notice--error" role="alert">{{ error }}</p>
        </div>
      </section>
    </dialog>
  </Teleport>
</template>

<style scoped>
.detail-overlay {
  width: min(1440px, calc(100vw - 48px));
  height: min(880px, calc(100dvh - 48px));
  max-width: none;
  max-height: none;
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  overscroll-behavior: contain;
}

.detail-overlay--compact {
  width: min(760px, calc(100vw - 48px));
}

.detail-overlay--rich {
  width: min(960px, calc(100vw - 48px));
}

.detail-overlay::backdrop {
  background: rgb(22 22 20 / 68%);
  opacity: 1;
  transition: opacity 160ms ease;
}

.detail-overlay__panel {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 14px;
  background: var(--surface-card);
  box-shadow: 0 30px 80px rgb(17 17 15 / 38%);
  opacity: 1;
  transform: translateY(0) scale(1);
  transition:
    opacity 220ms ease,
    transform 220ms var(--ease-card);
}

.detail-overlay--closing::backdrop {
  opacity: 0;
}

.detail-overlay--closing .detail-overlay__panel {
  opacity: 0;
  transform: translateY(8px) scale(0.985);
  transition-duration: 160ms;
}

.detail-overlay__title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.detail-overlay__reading-stage {
  display: grid;
  min-height: 100%;
  padding: 68px 24px 40px;
  place-items: center;
}

.detail-overlay__error {
  position: absolute;
  z-index: 9;
  top: 64px;
  right: 16px;
  width: min(360px, calc(100% - 32px));
  box-shadow: 0 12px 30px rgb(20 20 18 / 18%);
}

.detail-overlay__close {
  position: absolute;
  z-index: 10;
  top: 12px;
  right: 12px;
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface-card) 92%, transparent);
  color: var(--text-primary);
  cursor: pointer;
  place-items: center;
}

.detail-overlay__close:hover {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}

.detail-overlay__close:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.detail-overlay__close svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}

@starting-style {
  .detail-overlay[open]::backdrop {
    opacity: 0;
  }

  .detail-overlay[open] .detail-overlay__panel {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
  }
}

@media (max-width: 959px) {
  .detail-overlay {
    width: 100vw;
    height: 100dvh;
  }

  .detail-overlay__panel {
    border: 0;
    border-radius: 0;
  }

  .detail-overlay__close {
    top: max(8px, env(safe-area-inset-top));
    right: max(10px, env(safe-area-inset-right));
  }

  .detail-overlay__error {
    top: max(62px, calc(env(safe-area-inset-top) + 54px));
    right: max(10px, env(safe-area-inset-right));
    width: min(360px, calc(100% - 20px));
  }
}

@media (prefers-color-scheme: dark) {
  .detail-overlay__panel {
    border-color: #4b4a46;
    box-shadow: 0 30px 90px rgb(0 0 0 / 56%);
  }

  .detail-overlay::backdrop {
    background: rgb(8 8 7 / 76%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-overlay::backdrop,
  .detail-overlay__panel {
    transition-duration: 0.01ms;
  }

  .detail-overlay--closing .detail-overlay__panel,
  .detail-overlay[open] .detail-overlay__panel {
    transform: none;
  }

  @starting-style {
    .detail-overlay[open] .detail-overlay__panel {
      transform: none;
    }
  }
}
</style>
