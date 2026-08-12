<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { useJournalApi } from '../../composables/useJournalApi';
import type {
  JournalChannel,
  JournalDiscoveryListItem,
  JournalEntry,
} from '../../types';
import { showMessage } from '../../utils/message';
import JournalDetailOverlay from '../journal/JournalDetailOverlay.vue';

const props = defineProps<{
  entry: JournalDiscoveryListItem;
  loadedEntry?: JournalEntry;
}>();

const emit = defineEmits<{
  close: [];
  loaded: [entry: JournalEntry];
  unlocked: [entry: JournalEntry];
  selectTag: [channel: JournalChannel, tag: string];
}>();

const router = useRouter();
const journal = useJournalApi();
const initialLoading = shallowRef(!props.loadedEntry && props.entry.kind !== 'protected');
let errorMessage: ReturnType<typeof showMessage> | null = null;

if (props.loadedEntry) journal.selectDetail(props.loadedEntry);
else if (props.entry.kind === 'protected') journal.selectProtectedDetail(props.entry);

function exposeError(): void {
  const error = journal.error.value;
  if (!error) return;
  errorMessage?.close();
  errorMessage = showMessage({ message: error, type: 'error', duration: 0 });
}

onMounted(async () => {
  if (props.loadedEntry || props.entry.kind === 'protected') return;
  await journal.loadPublicDetail(props.entry.publicId);
  initialLoading.value = false;
  if (journal.detail.value) emit('loaded', journal.detail.value);
  exposeError();
});

onBeforeUnmount(() => errorMessage?.close());

async function unlock(password: string): Promise<void> {
  await journal.unlockDetail(password);
  const entry = journal.detail.value;
  if (!entry) {
    exposeError();
    return;
  }

  const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
  await router.replace({
    name: 'detail',
    params: { publicId: entry.publicId },
    force: true,
    state: {
      journalDetailFromFeed: state?.journalDetailFromFeed === true ? true : undefined,
      journalProtectedPreview: undefined,
    },
  });
  emit('unlocked', entry);
}

function selectTag(tag: string): void {
  const entry = journal.detail.value;
  if (!entry) throw new Error('Journal detail must load before selecting a tag.');
  emit('selectTag', entry.channel, tag);
}
</script>

<template>
  <JournalDetailOverlay
    :entry="journal.detail.value ?? undefined"
    :protected-entry="journal.protectedDetail.value ?? undefined"
    mode="public"
    :busy="false"
    :loading="initialLoading || journal.loading.value"
    :unlocking="journal.unlocking.value"
    :unlock-error="journal.unlockError.value"
    @close="emit('close')"
    @unlock="unlock"
    @select-tag="selectTag"
  />
</template>
