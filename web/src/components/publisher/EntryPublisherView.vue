<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { vLoading } from 'element-plus';
import { useRouter } from 'vue-router';
import AiSuggestionButton from '../ui/AiSuggestionButton.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { useEntryPublisher } from '../../composables/useEntryPublisher';
import { useEntryMediaSubmit } from '../../composables/useEntryMediaSubmit';
import { useTagSuggestions } from '../../composables/useTagSuggestions';
import { useTopicSuggestion } from '../../composables/useTopicSuggestion';
import { plainJournalChannels } from '../../journalChannels';
import type { JournalAsset, JournalPlainChannel, JournalVisibility } from '../../types';
import { showMessage } from '../../utils/message';
import { copyEntryAccessLink } from '../../utils/accessLink';
import { appendJournalTags } from '../../utils/journalTags';
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
import EntryTopicField from './EntryTopicField.vue';

const props = withDefaults(defineProps<{
  entryId?: number;
}>(), {
  entryId: undefined,
});

const router = useRouter();
const publisher = useEntryPublisher();
const tagSuggestions = useTagSuggestions();
const topicSuggestion = useTopicSuggestion();
const title = shallowRef('');
const contentText = shallowRef('');
const channel = shallowRef<JournalPlainChannel>('life');
const visibility = shallowRef<JournalVisibility>('public');
const accessPassword = shallowRef('');
const newMedia = shallowRef<File[]>([]);
const removedAssetIds = shallowRef<ReadonlySet<number>>(new Set());
const specifyTime = shallowRef(false);
const specifiedTime = shallowRef('');
const initializedEntryId = shallowRef<number | null>(null);
const assetChanged = shallowRef(false);
const stalledPublishProbe = shallowRef(previousPublishProbe());
const mediaSubmit = useEntryMediaSubmit();
let terminalErrorMessage: ReturnType<typeof showMessage> | null = null;

const isEditing = computed(() => props.entryId !== undefined);
const isPublished = computed(() => publisher.entry.value?.publicationStatus === 'published');
const topicEditable = computed(() => !isPublished.value || publisher.entry.value?.sourceKind === 'web');
const mediaEditable = computed(() => !isPublished.value || publisher.entry.value?.sourceKind === 'web');
const formAvailable = computed(() => !isEditing.value || publisher.entry.value !== null);
const existingAssets = computed<JournalAsset[]>(() =>
  (publisher.entry.value?.assets ?? []).filter(asset => !removedAssetIds.value.has(asset.id)),
);
const busy = computed(() =>
  publisher.loading.value
  || (isEditing.value && publisher.entry.value === null)
  || publisher.submitting.value !== null
  || mediaSubmit.busy.value,
);
const hasContent = computed(() =>
  contentText.value.trim().length > 0 || existingAssets.value.length + newMedia.value.length > 0,
);
const canSaveDraft = computed(() =>
  formAvailable.value
  && hasContent.value
  && !busy.value,
);
const hasExistingPassword = computed(() =>
  isPublished.value && publisher.entry.value?.visibility === 'protected',
);
const accessSettingsValid = computed(() =>
  visibility.value !== 'protected'
  || /^\d{6}$/.test(accessPassword.value)
  || (hasExistingPassword.value && accessPassword.value === ''),
);
const canPublish = computed(() =>
  canSaveDraft.value
  && accessSettingsValid.value
  && (!specifyTime.value || specifiedTime.value !== ''),
);
const canSavePublished = computed(() =>
  isPublished.value
  && hasContent.value
  && specifiedTime.value !== ''
  && accessSettingsValid.value
  && !busy.value,
);
const routeError = computed(() => publisher.error.value);
const tagSuggestionInputAvailable = computed(() =>
  title.value.trim().length > 0 || contentText.value.trim().length > 0,
);
const topicSuggestionInputAvailable = computed(() => contentText.value.trim().length > 0);

watch(() => publisher.entry.value, (entry) => {
  if (!entry || initializedEntryId.value === entry.id) return;
  initializedEntryId.value = entry.id;
  title.value = entry.title ?? '';
  contentText.value = entry.contentText;
  channel.value = entry.channel as JournalPlainChannel;
  visibility.value = entry.visibility;
  accessPassword.value = '';
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
  const state = window.history.state as { journalReturnPath?: string } | null;
  void router.push({
    path: state?.journalReturnPath ?? '/me',
    state: { journalAssetChanged: assetChanged.value },
  });
}

function buildInput() {
  return {
    title: title.value.trim() || null,
    contentText: contentText.value,
    uploadId: '',
    removedAssetIds: [...removedAssetIds.value],
    channel: channel.value,
    visibility: visibility.value,
    ...(visibility.value === 'protected' && accessPassword.value
      ? { accessPassword: accessPassword.value }
      : {}),
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
  assetChanged.value = true;
  title.value = saved.title ?? '';
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
  assetChanged.value = true;
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
  assetChanged.value = true;
  title.value = saved.title ?? '';
  newMedia.value = [];
  removedAssetIds.value = new Set();
  showMessage({ message: '记录修改已保存', type: 'success' });
}

async function submit(): Promise<void> {
  if (isPublished.value) await savePublished();
  else await publish();
}

async function copyAccessLink(): Promise<void> {
  const entry = publisher.entry.value;
  if (!entry) return;
  try {
    await copyEntryAccessLink(entry.publicId);
    showMessage({ message: '访问链接已复制', type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}

async function generateTags(): Promise<void> {
  try {
    const tags = await tagSuggestions.generate({
      kind: 'entry',
      channel: channel.value,
      title: title.value.trim() || null,
      contentText: contentText.value,
    });
    const result = appendJournalTags(contentText.value, tags);
    if (result.addedTags.length === 0) {
      showMessage({ message: '没有新的标签可补充', type: 'info' });
      return;
    }
    contentText.value = result.contentText;
    showMessage({ message: `已补充 ${result.addedTags.length} 个标签`, type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}

async function generateTopic(): Promise<void> {
  try {
    const topic = await topicSuggestion.generate(contentText.value);
    title.value = topic;
    showMessage({ message: '主题已生成', type: 'success' });
  }
  catch (reason) {
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
}
</script>

<template>
  <main class="publisher-view">
    <header class="publisher-view__heading">
      <button class="text-button" type="button" @click="returnToAssets">← 返回我的全部记录</button>
      <h1>{{ isEditing ? '编辑记录' : '写一条新记录' }}</h1>
      <p>{{ isEditing ? '继续整理文字，留住想记下的细节。' : '生活里的小事，也值得被记下来。' }}</p>
    </header>

    <aside v-if="stalledPublishProbe" class="publisher-view__probe">
      <span>检测到上次发布在刷新前停留于</span>
      <code>{{ stalledPublishProbe.stage }}</code>
      <time :datetime="new Date(stalledPublishProbe.updatedAt).toISOString()">
        {{ formatProbeTime(stalledPublishProbe.updatedAt) }}
      </time>
    </aside>

    <div class="publisher-view__stage" :aria-busy="publisher.loading.value">
        <form v-loading="publisher.loading.value" class="publisher-view__form" @submit.prevent="submit">
          <div class="publisher-view__manuscript">
            <div class="publisher-view__copy">
              <EntryTopicField v-if="topicEditable" v-model="title" :disabled="busy" />

              <div class="field">
                <div class="publisher-view__field-heading">
                  <label class="field__label" for="entry-content">正文</label>
                  <div class="publisher-view__ai-actions">
                    <AiSuggestionButton
                      v-if="topicEditable"
                      label="AI 生成主题"
                      busy-label="生成中…"
                      :disabled="!topicSuggestionInputAvailable || tagSuggestions.busy.value"
                      :busy="topicSuggestion.busy.value"
                      @generate="generateTopic"
                    />
                    <AiSuggestionButton
                      label="AI 生成标签"
                      busy-label="生成中…"
                      :disabled="!tagSuggestionInputAvailable || topicSuggestion.busy.value"
                      :busy="tagSuggestions.busy.value"
                      @generate="generateTags"
                    />
                  </div>
                </div>
                <textarea
                  id="entry-content"
                  v-model="contentText"
                  rows="10"
                  placeholder="写下内容，可直接使用 #标签"
                  :disabled="busy"
                />
              </div>
            </div>

            <EntryImagePicker
              v-if="mediaEditable"
              class="publisher-view__media"
              v-model="newMedia"
              :existing-assets="existingAssets"
              :disabled="busy"
            />

            <EntryMediaPreviewGrid
              v-if="existingAssets.length || newMedia.length"
              v-model="newMedia"
              class="publisher-view__previews"
              :existing-assets="existingAssets"
              :disabled="busy || !mediaEditable"
              @remove-existing="removeExisting"
            />
          </div>

          <aside class="publisher-view__sidebar">
            <h2 class="publisher-view__sidebar-title">这条记录</h2>
            <div class="publisher-view__settings">
              <div class="publisher-view__fields-row">
                <EntryChannelField v-model="channel" :disabled="busy" />

                <EntryVisibilityField
                  :key="publisher.entry.value?.updatedAt ?? 'new'"
                  v-model="visibility"
                  v-model:access-password="accessPassword"
                  :disabled="busy"
                  :has-existing-password="hasExistingPassword"
                />
              </div>

              <EntryPublishedTimeField
                :key="publisher.entry.value?.updatedAt ?? 'new'"
                v-model:enabled="specifyTime"
                v-model:value="specifiedTime"
                :disabled="busy"
              />

              <div class="publisher-view__actions">
                <button
                  v-if="isPublished && publisher.entry.value?.visibility === 'protected'"
                  class="button button--quiet"
                  type="button"
                  :disabled="busy"
                  @click="copyAccessLink"
                >
                  复制访问链接
                </button>
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
    </div>
  </main>
</template>

<style scoped>
.publisher-view {
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-workspace-width));
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.publisher-view__heading {
  margin-bottom: 2rem;
}

.publisher-view__heading .text-button {
  color: var(--text-muted);
}

.publisher-view__heading h1 {
  margin: 1.5rem 0 0.5rem;
  font-family: var(--font-serif);
  font-size: clamp(1.6rem, 3vw, 2rem);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.publisher-view__heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.7;
}

.publisher-view__probe {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: baseline;
  margin-bottom: 1.5rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-muted);
  font-size: 0.78rem;
}

.publisher-view__probe code {
  color: var(--text-primary);
  font-weight: 650;
}

.publisher-view__form {
  --el-color-primary: var(--accent-strong);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 19rem;
  gap: 2.5rem;
  align-items: start;
}

.publisher-view__form :deep(.el-loading-mask) {
  background: color-mix(in srgb, var(--surface-page) 82%, transparent);
}

.publisher-view__manuscript {
  display: grid;
  gap: 1.75rem;
  min-width: 0;
  padding: 2rem;
  border-radius: 4px;
  background: var(--surface-card);
}

.publisher-view__copy {
  display: grid;
  gap: 1.75rem;
}

.publisher-view__copy :deep(.topic-field) {
  gap: 0.6rem;
}

.publisher-view__copy :deep(.topic-field input) {
  width: 100%;
  padding: 0.5rem 0 1rem;
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
  border-radius: 0;
  background: transparent;
  font-family: var(--font-serif);
  font-size: 1.35rem;
  line-height: 1.6;
}

.publisher-view__copy :deep(.topic-field input:focus) {
  border-bottom-color: var(--accent);
}

.publisher-view__copy :deep(input::placeholder),
.publisher-view__copy textarea::placeholder {
  color: var(--text-muted);
  opacity: 0.7;
}

.publisher-view__field-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.5rem;
}

.publisher-view__ai-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.publisher-view__form textarea {
  width: 100%;
  min-height: 18rem;
  padding: 0.5rem 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  font-size: 0.95rem;
  line-height: 1.9;
  resize: vertical;
}

.publisher-view__media {
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-subtle);
}

.publisher-view__media :deep(.image-picker__drop-zone) {
  min-height: 7rem;
  border-color: var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-page);
}

.publisher-view__media :deep(.image-picker__drop-zone:hover:not(:disabled)),
.publisher-view__media :deep(.image-picker__drop-zone--over) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.publisher-view__media :deep(.image-picker__drop-title) {
  font-weight: 500;
}

.publisher-view__previews {
  min-width: 0;
}

.publisher-view__sidebar {
  min-width: 0;
  padding: 0.5rem 0 0.5rem 1.75rem;
  border-left: 1px solid var(--border-subtle);
}

.publisher-view__sidebar-title {
  margin: 0 0 1.75rem;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
}

.publisher-view__settings,
.publisher-view__fields-row {
  display: grid;
  gap: 1.5rem;
  min-width: 0;
}

.publisher-view__sidebar :deep(.channel-field),
.publisher-view__sidebar :deep(.visibility-field) {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.25rem;
}

.publisher-view__sidebar :deep(.channel-field__label),
.publisher-view__sidebar :deep(.visibility-field__label),
.publisher-view__sidebar :deep(.published-time-field__label) {
  margin-bottom: 0.7rem;
  font-weight: 500;
  letter-spacing: 0.06em;
}

.publisher-view__sidebar :deep(.channel-field__option),
.publisher-view__sidebar :deep(.visibility-field__option),
.publisher-view__sidebar :deep(.published-time-field__option) {
  gap: 0.7rem;
  padding: 0.65rem 0.5rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
}

.publisher-view__sidebar :deep(.channel-field__option:has(input:checked)),
.publisher-view__sidebar :deep(.visibility-field__option:has(input:checked)),
.publisher-view__sidebar :deep(.published-time-field__option:has(input:checked)) {
  background: var(--accent-soft);
}

.publisher-view__sidebar :deep(.channel-field__option:has(input:checked) strong),
.publisher-view__sidebar :deep(.visibility-field__option:has(input:checked) strong) {
  color: var(--accent-strong);
}

.publisher-view__sidebar :deep(.channel-field__option:has(input:focus-visible)),
.publisher-view__sidebar :deep(.visibility-field__option:has(input:focus-visible)) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.publisher-view__sidebar :deep(.visibility-field),
.publisher-view__sidebar :deep(.published-time-field) {
  padding-top: 1.25rem;
  border-top: 1px solid var(--border-subtle);
}

.publisher-view__sidebar :deep(.published-time-field__inputs) {
  flex-wrap: wrap;
  padding: 0.5rem 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.publisher-view__sidebar :deep(.published-time-field__input) {
  flex-basis: 7rem;
}

.publisher-view__sidebar :deep(.visibility-field__password) {
  margin-top: 0.5rem;
}

.publisher-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border-subtle);
}

.publisher-view__actions .button {
  flex: 1 1 6rem;
  min-height: 2.75rem;
}

.publisher-view__actions .button--quiet {
  background: transparent;
}

@media (max-width: 1000px) {
  .publisher-view {
    max-width: var(--editor-width);
  }

  .publisher-view__form {
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }

  .publisher-view__sidebar {
    padding: 0;
    border-left: 0;
  }

  .publisher-view__fields-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2rem;
  }

  .publisher-view__sidebar :deep(.visibility-field) {
    padding-top: 0;
    border-top: 0;
  }

  .publisher-view__actions {
    justify-content: flex-end;
  }

  .publisher-view__actions .button {
    flex: 0 1 10rem;
  }
}

@media (max-width: 599px) {
  .publisher-view {
    padding-top: 1.25rem;
  }

  .publisher-view__heading {
    padding-inline: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .publisher-view__manuscript {
    gap: 1.5rem;
    padding: 1.25rem;
  }

  .publisher-view__copy :deep(.topic-field input) {
    font-size: 1.15rem;
  }

  .publisher-view__form textarea {
    min-height: 15rem;
  }

  .publisher-view__sidebar {
    padding-inline: 0.5rem;
  }

  .publisher-view__fields-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }

  .publisher-view__sidebar :deep(.visibility-field) {
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-subtle);
  }

  .publisher-view__actions .button {
    flex: 1 1 6rem;
  }
}
</style>
