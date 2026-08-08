<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import JournalLoading from '../ui/JournalLoading.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import { useEntryPublisher } from '../../composables/useEntryPublisher';
import { useEntryMediaSubmit } from '../../composables/useEntryMediaSubmit';
import { plainJournalChannels } from '../../journalChannels';
import type { JournalAsset, JournalPlainChannel, JournalVisibility } from '../../types';
import { showMessage } from '../../utils/message';
import {
  beginPublishProbe,
  clearPublishProbe,
  markPublishProbe,
  previousPublishProbe,
} from '../../utils/publishProbe';
import EntryImagePicker from './EntryImagePicker.vue';
import EntryMediaPreviewGrid from './EntryMediaPreviewGrid.vue';
import EntryChannelField from './EntryChannelField.vue';
import EntryVisibilityField from './EntryVisibilityField.vue';
import EntryPublishedTimeField from './EntryPublishedTimeField.vue';

const props = withDefaults(defineProps<{
  entryId?: number;
}>(), {
  entryId: undefined,
});

const router = useRouter();
const publisher = useEntryPublisher();
const contentText = shallowRef('');
const channel = shallowRef<JournalPlainChannel>('life');
const visibility = shallowRef<JournalVisibility>('public');
const newMedia = shallowRef<File[]>([]);
const removedAssetIds = shallowRef<ReadonlySet<number>>(new Set());
const specifyTime = shallowRef(false);
const specifiedTime = shallowRef('');
const initializedEntryId = shallowRef<number | null>(null);
const stalledPublishProbe = shallowRef(previousPublishProbe());
const mediaSubmit = useEntryMediaSubmit();
let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;

const isEditing = computed(() => props.entryId !== undefined);
const awaitingDraft = computed(() =>
  isEditing.value && publisher.entry.value === null && publisher.error.value === null,
);
const deferredLoading = useDeferredLoading(awaitingDraft);
const isPublished = computed(() => publisher.entry.value?.publicationStatus === 'published');
const mediaEditable = computed(() => !isPublished.value || publisher.entry.value?.sourceKind === 'web');
const formAvailable = computed(() => !isEditing.value || publisher.entry.value !== null);
const existingAssets = computed<JournalAsset[]>(() =>
  (publisher.entry.value?.assets ?? []).filter(asset => !removedAssetIds.value.has(asset.id)),
);
const busy = computed(() => publisher.submitting.value !== null || mediaSubmit.busy.value);
const hasContent = computed(() =>
  contentText.value.trim().length > 0 || existingAssets.value.length + newMedia.value.length > 0,
);
const canSaveDraft = computed(() =>
  formAvailable.value
  && hasContent.value
  && !busy.value,
);
const canPublish = computed(() =>
  canSaveDraft.value
  && (!specifyTime.value || specifiedTime.value !== ''),
);
const canSavePublished = computed(() => isPublished.value && hasContent.value && specifiedTime.value !== '' && !busy.value);
const routeError = computed(() => publisher.error.value);

watch(() => publisher.entry.value, (entry) => {
  if (!entry || initializedEntryId.value === entry.id) return;
  initializedEntryId.value = entry.id;
  contentText.value = entry.contentText;
  channel.value = entry.channel as JournalPlainChannel;
  visibility.value = entry.visibility;
  specifyTime.value = true;
  specifiedTime.value = entry.sourceCreatedAt;
  newMedia.value = [];
  removedAssetIds.value = new Set();
});

watch(routeError, (error) => {
  if (!error) {
    terminalErrorMessage?.close();
    terminalErrorMessage = null;
    return;
  }
  if (!formAvailable.value) {
    terminalErrorMessage?.close();
    terminalErrorMessage = showMessage({ message: error, type: 'error', duration: 0 });
    return;
  }
  showMessage({ message: error, type: 'error' });
});

watch(() => mediaSubmit.error.value, (error) => {
  if (error) showMessage({ message: error, type: 'error' });
});

onMounted(async () => {
  if (props.entryId === undefined) return;
  await publisher.load(props.entryId);
});

onBeforeUnmount(() => terminalErrorMessage?.close());

function removeExisting(assetId: number): void {
  if (!mediaEditable.value) return;
  removedAssetIds.value = new Set([...removedAssetIds.value, assetId]);
}

function returnToAssets(): void {
  const state = router.currentRoute.value.state as { journalReturnPath?: string };
  void router.push(state.journalReturnPath ?? '/me');
}

function buildInput() {
  return {
    contentText: contentText.value,
    uploadId: '',
    removedAssetIds: [...removedAssetIds.value],
    channel: channel.value,
    visibility: visibility.value,
    sourceCreatedAt: specifyTime.value ? specifiedTime.value : undefined,
  };
}

function channelLabel(value: JournalPlainChannel): string {
  return plainJournalChannels.find(option => option.value === value)!.label;
}

function formatProbeTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestamp);
}

async function saveDraft(): Promise<void> {
  const uploadId = await mediaSubmit.submit(newMedia.value, publisher.entry.value?.id);
  if (!uploadId) return;
  const saved = await publisher.saveDraft({ ...buildInput(), uploadId });
  if (!saved) return;
  initializedEntryId.value = saved.id;
  contentText.value = saved.contentText;
  newMedia.value = [];
  removedAssetIds.value = new Set();
  showMessage({
    message: `草稿已保存到“${channelLabel(channel.value)}”频道`,
    type: 'success',
  });
  if (!isEditing.value) {
    await router.replace({ name: 'entry-edit', params: { entryId: saved.id } });
  }
}

async function publish(): Promise<void> {
  beginPublishProbe();
  const uploadId = await mediaSubmit.submit(newMedia.value, publisher.entry.value?.id);
  if (!uploadId) {
    clearPublishProbe();
    return;
  }
  const published = await publisher.publish({ ...buildInput(), uploadId });
  if (!published) {
    clearPublishProbe();
    return;
  }
  showMessage({
    message: `已发布到“${channelLabel(channel.value)}”频道`,
    type: 'success',
  });
  markPublishProbe('NAVIGATION_STARTED');
  returnToAssets();
  clearPublishProbe();
  stalledPublishProbe.value = null;
}

async function savePublished(): Promise<void> {
  const uploadId = publisher.entry.value?.sourceKind === 'web'
    ? await mediaSubmit.submit(newMedia.value, publisher.entry.value.id)
    : '';
  if (publisher.entry.value?.sourceKind === 'web' && !uploadId) return;
  const saved = await publisher.updatePublished({
    ...buildInput(),
    uploadId,
    sourceCreatedAt: specifiedTime.value,
  });
  if (!saved) return;
  newMedia.value = [];
  removedAssetIds.value = new Set();
  showMessage({ message: '记录修改已保存', type: 'success' });
}

async function submit(): Promise<void> {
  if (isPublished.value) await savePublished();
  else await publish();
}
</script>

<template>
  <main class="publisher-view">
    <div class="publisher-view__heading">
      <button class="text-button" type="button" @click="returnToAssets">← 返回我的全部记录</button>
      <span>{{ isPublished ? '编辑记录' : isEditing ? '编辑草稿' : '发布内容' }}</span>
    </div>

    <aside v-if="stalledPublishProbe" class="publisher-view__probe">
      <span>检测到上次发布在刷新前停留于</span>
      <code>{{ stalledPublishProbe.stage }}</code>
      <time :datetime="new Date(stalledPublishProbe.updatedAt).toISOString()">
        {{ formatProbeTime(stalledPublishProbe.updatedAt) }}
      </time>
    </aside>

    <div class="publisher-view__stage" :class="{ 'publisher-view__stage--reading': !formAvailable }" :aria-busy="awaitingDraft">
      <Transition name="publisher-stage" mode="out-in">
        <JournalLoading v-if="deferredLoading.visible.value" key="loading" variant="reading" label="正在打开草稿…" />
        <form v-else-if="formAvailable" key="form" class="publisher-view__form" @submit.prevent="submit">
          <div class="publisher-view__manuscript">
            <label class="field">
              <span class="field__label">正文</span>
              <textarea
                v-model="contentText"
                rows="10"
                placeholder="写下内容，可直接使用 #标签"
                :disabled="busy"
              />
            </label>

            <EntryImagePicker
              v-if="mediaEditable"
              class="publisher-view__media"
              v-model="newMedia"
              :existing-assets="existingAssets"
              :disabled="busy"
            />
          </div>

          <EntryMediaPreviewGrid
            v-if="existingAssets.length || newMedia.length"
            v-model="newMedia"
            class="publisher-view__previews"
            :existing-assets="existingAssets"
            :disabled="busy || !mediaEditable"
            @remove-existing="removeExisting"
          />

          <aside class="publisher-view__sidebar">
            <h2 class="publisher-view__sidebar-title">发布设置</h2>
            <div class="publisher-view__settings">
              <div class="publisher-view__fields-row">
                <EntryChannelField v-model="channel" :disabled="busy" />

                <EntryVisibilityField v-model="visibility" :disabled="busy" />
              </div>

              <EntryPublishedTimeField
                :key="publisher.entry.value?.updatedAt ?? 'new'"
                v-model:enabled="specifyTime"
                v-model:value="specifiedTime"
                :disabled="busy"
              />

              <div class="publisher-view__actions">
                <button
                  v-if="!isPublished"
                  class="button button--quiet"
                  type="button"
                  :disabled="!canSaveDraft"
                  :aria-busy="publisher.submitting.value === 'draft'"
                  @click="saveDraft"
                >
                  <JournalLoading v-if="publisher.submitting.value === 'draft'" variant="inline" label="保存中…" />
                  <template v-else>保存草稿</template>
                </button>
                <button
                  class="button button--primary"
                  type="submit"
                  :disabled="isPublished ? !canSavePublished : !canPublish"
                  :aria-busy="publisher.submitting.value === 'publish'"
                >
                  <JournalLoading v-if="publisher.submitting.value === 'publish'" variant="inline" :label="isPublished ? '保存中…' : '发布中…'" />
                  <template v-else>{{ isPublished ? '保存修改' : '发布' }}</template>
                </button>
              </div>
            </div>
          </aside>
        </form>
        <div v-else key="reserve" class="publisher-view__reading-reserve" aria-hidden="true"></div>
      </Transition>
    </div>
  </main>
</template>

<style scoped>
.publisher-view {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-workspace-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.publisher-view__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.publisher-view__probe {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: baseline;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 0.78rem;
}

.publisher-view__probe code {
  color: var(--text-primary);
  font-weight: 650;
}

.publisher-view__stage {
  display: grid;
}

.publisher-view__form {
  display: grid;
  grid-template-columns: minmax(0, var(--editor-width)) minmax(18rem, 1fr);
  gap: 1rem;
  align-items: start;
}

.publisher-view__manuscript {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-column: 1;
  grid-row: 1;
  gap: 1rem;
  min-width: 0;
  height: 33.4rem;
}

.publisher-view__media {
  min-height: 0;
  grid-template-rows: auto minmax(8rem, 1fr);
}

.publisher-view__sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-column: 2;
  grid-row: 1;
  gap: 0.3rem;
  min-width: 0;
  height: 33.4rem;
}

.publisher-view__previews {
  grid-column: 1;
  grid-row: 2;
}

.publisher-view__sidebar-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 650;
}

.publisher-view__settings {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.publisher-view__fields-row {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.publisher-view__form textarea {
  width: 100%;
  min-height: 14rem;
  resize: none;
  line-height: 1.7;
}

.publisher-view__actions {
  display: flex;
  align-self: end;
  gap: 0.65rem;
}

.publisher-view__actions .button {
  flex: 1 1 0;
}

.publisher-view__stage--reading,
.publisher-view__reading-reserve {
  width: min(100%, var(--editor-width));
  min-height: 50vh;
  margin: 0 auto;
}

.publisher-stage-enter-active {
  transition: opacity var(--dur-loading-enter) var(--ease-card);
}

.publisher-stage-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.publisher-stage-enter-from,
.publisher-stage-leave-to {
  opacity: 0;
}

@media (max-width: 1180px) {
  .publisher-view {
    width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
  }

  .publisher-view__form {
    grid-template-columns: minmax(0, 1fr);
  }

  .publisher-view__manuscript,
  .publisher-view__previews,
  .publisher-view__sidebar {
    grid-column: 1;
    grid-row: auto;
  }

  .publisher-view__manuscript,
  .publisher-view__sidebar {
    height: auto;
  }

  .publisher-view__form textarea {
    resize: vertical;
  }

}

@media (min-width: 600px) and (max-width: 1180px) {
  .publisher-view__fields-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
