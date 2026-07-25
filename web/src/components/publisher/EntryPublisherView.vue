<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import JournalLoading from '../ui/JournalLoading.vue';
import { useDeferredLoading } from '../../composables/useDeferredLoading';
import { useEntryPublisher } from '../../composables/useEntryPublisher';
import type { JournalAsset, JournalVisibility } from '../../types';
import EntryImagePicker from './EntryImagePicker.vue';
import EntryVisibilityField from './EntryVisibilityField.vue';

const props = withDefaults(defineProps<{
  entryId?: number;
}>(), {
  entryId: undefined,
});

const router = useRouter();
const publisher = useEntryPublisher();
const contentText = shallowRef('');
const visibility = shallowRef<JournalVisibility>('public');
const newImages = shallowRef<File[]>([]);
const removedAssetIds = shallowRef<ReadonlySet<number>>(new Set());
const initializedEntryId = shallowRef<number | null>(null);

const isEditing = computed(() => props.entryId !== undefined);
const awaitingDraft = computed(() =>
  isEditing.value && publisher.entry.value === null && publisher.error.value === null,
);
const deferredLoading = useDeferredLoading(awaitingDraft);
const isDraft = computed(() => publisher.entry.value?.publicationStatus === 'draft');
const formAvailable = computed(() => !isEditing.value || isDraft.value);
const existingAssets = computed<JournalAsset[]>(() =>
  (publisher.entry.value?.assets ?? []).filter(asset => !removedAssetIds.value.has(asset.id)),
);
const busy = computed(() => publisher.submitting.value !== null);
const hasContent = computed(() =>
  contentText.value.trim().length > 0 || existingAssets.value.length + newImages.value.length > 0,
);
const canSubmit = computed(() => formAvailable.value && hasContent.value && !busy.value);
const routeError = computed(() => {
  if (publisher.error.value) return publisher.error.value;
  if (publisher.entry.value && !isDraft.value) return '这条记录已经发布，不能再作为草稿编辑。';
  return null;
});

watch(() => publisher.entry.value, (entry) => {
  if (!entry || initializedEntryId.value === entry.id) return;
  initializedEntryId.value = entry.id;
  contentText.value = entry.contentText;
  newImages.value = [];
  removedAssetIds.value = new Set();
});

onMounted(() => {
  if (props.entryId !== undefined) void publisher.load(props.entryId);
});

function removeExisting(assetId: number): void {
  removedAssetIds.value = new Set([...removedAssetIds.value, assetId]);
}

function buildInput() {
  return {
    contentText: contentText.value,
    newImages: newImages.value,
    removedAssetIds: [...removedAssetIds.value],
    visibility: visibility.value,
  };
}

async function saveDraft(): Promise<void> {
  const saved = await publisher.saveDraft(buildInput());
  if (!saved) return;
  initializedEntryId.value = saved.id;
  contentText.value = saved.contentText;
  newImages.value = [];
  removedAssetIds.value = new Set();
  if (!isEditing.value) {
    await router.replace({ name: 'entry-edit', params: { entryId: saved.id } });
  }
}

async function publish(): Promise<void> {
  const published = await publisher.publish(buildInput());
  if (!published) return;
  await router.push({ name: 'private' });
}
</script>

<template>
  <main class="publisher-view">
    <div class="publisher-view__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的全部记录</button>
      <span>{{ isEditing ? '编辑草稿' : '发布内容' }}</span>
    </div>

    <p v-if="routeError && formAvailable" class="notice notice--error" role="alert">{{ routeError }}</p>

    <div class="publisher-view__stage" :class="{ 'publisher-view__stage--reading': !formAvailable }" :aria-busy="awaitingDraft">
      <Transition name="publisher-stage" mode="out-in">
        <JournalLoading v-if="deferredLoading.visible.value" key="loading" variant="reading" label="正在打开草稿…" />
        <p v-else-if="routeError && !formAvailable" key="error" class="notice notice--error" role="alert">{{ routeError }}</p>
        <form v-else-if="formAvailable" key="form" class="publisher-view__form" @submit.prevent="publish">
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
            v-model="newImages"
            :existing-assets="existingAssets"
            :disabled="busy"
            @remove-existing="removeExisting"
          />

          <EntryVisibilityField v-model="visibility" :disabled="busy" />

          <div class="publisher-view__actions">
            <button
              class="button button--quiet"
              type="button"
              :disabled="!canSubmit"
              :aria-busy="publisher.submitting.value === 'draft'"
              @click="saveDraft"
            >
              <JournalLoading v-if="publisher.submitting.value === 'draft'" variant="inline" label="保存中…" />
              <template v-else>保存草稿</template>
            </button>
            <button
              class="button button--primary"
              type="submit"
              :disabled="!canSubmit"
              :aria-busy="publisher.submitting.value === 'publish'"
            >
              <JournalLoading v-if="publisher.submitting.value === 'publish'" variant="inline" label="发布中…" />
              <template v-else>发布</template>
            </button>
          </div>
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
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
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

.publisher-view__stage,
.publisher-view__form {
  display: grid;
}

.publisher-view__form {
  gap: 1rem;
}

.publisher-view__form textarea {
  width: 100%;
  min-height: 14rem;
  resize: vertical;
  line-height: 1.7;
}

.publisher-view__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
}

.publisher-view__stage--reading,
.publisher-view__reading-reserve {
  min-height: 50vh;
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
</style>
