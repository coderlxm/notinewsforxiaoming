<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ArticleCardContent from '../../article/ArticleCardContent.vue';
import { useDeferredLoading } from '../../../composables/useDeferredLoading';
import { useJournalErrorMessage } from '../../../composables/useJournalErrorMessage';
import { useJournalApi } from '../../../composables/useJournalApi';
import { publicFeedPath } from '../../../journalChannels';
import type {
  JournalChannel,
  JournalEntry,
  JournalInteractionSummary,
  ProtectedJournalEntryPreview,
} from '../../../types';
import JournalLoading from '../../ui/JournalLoading.vue';
import JournalPullRefresh from '../../ui/JournalPullRefresh.vue';
import JournalInteractions from '../../interaction/JournalInteractions.vue';
import EntryCard from '../EntryCard.vue';
import ProtectedEntryUnlock from '../ProtectedEntryUnlock.vue';

const props = defineProps<{
  detailId: string;
}>();

const emit = defineEmits<{
  detailLoaded: [entry: JournalEntry];
  detailUnlocked: [entry: JournalEntry];
  interactionsChange: [publicId: string, summary: JournalInteractionSummary];
  returnToFeed: [];
}>();

const journal = useJournalApi();
const route = useRoute();
const router = useRouter();
const initialLoadPending = shallowRef(true);
const refreshing = shallowRef(false);
const protectedDetailChannel = shallowRef<JournalChannel | null>(null);
let protectedRobotsMeta: HTMLMetaElement | null = null;

const detailPreparing = computed(() => initialLoadPending.value);
const deferredDetailLoading = useDeferredLoading(detailPreparing);

useJournalErrorMessage(journal.error, () => true);

function prepareProtectedDetail(entry: ProtectedJournalEntryPreview): void {
  journal.selectProtectedDetail(entry);
  protectedDetailChannel.value = entry.channel;
  protectedRobotsMeta = document.createElement('meta');
  protectedRobotsMeta.name = 'robots';
  protectedRobotsMeta.content = 'noindex, nofollow';
  document.head.append(protectedRobotsMeta);
}

onMounted(async () => {
  try {
    const routeState = window.history.state as {
      journalProtectedPreview?: ProtectedJournalEntryPreview;
    } | null;
    if (routeState?.journalProtectedPreview?.publicId === props.detailId) {
      prepareProtectedDetail(routeState.journalProtectedPreview);
      return;
    }
    await journal.loadPublicDetail(props.detailId);
    if (journal.detail.value) emit('detailLoaded', journal.detail.value);
    if (journal.protectedDetail.value) {
      prepareProtectedDetail(journal.protectedDetail.value);
    }
  } finally {
    initialLoadPending.value = false;
  }
});

onBeforeUnmount(() => {
  protectedRobotsMeta?.remove();
});

function isArticleEntry(entry: JournalEntry): boolean {
  return entry.bodyFormat === 'rich';
}

function selectTag(tag: string): void {
  const channel = journal.detail.value!.channel;
  void router.push(publicFeedPath(channel, tag));
}

async function unlockDetail(password: string): Promise<void> {
  await journal.unlockDetail(password);
  if (!journal.detail.value) return;

  const state = window.history.state as {
    journalDetailFromFeed?: boolean;
    journalProtectedPreview?: ProtectedJournalEntryPreview;
  } | null;
  if (state?.journalProtectedPreview) {
    await router.replace({
      name: 'detail',
      params: { publicId: journal.detail.value.publicId },
      force: true,
      state: {
        journalDetailFromFeed: state.journalDetailFromFeed === true ? true : undefined,
        journalProtectedPreview: undefined,
      },
    });
  }
  emit('detailUnlocked', journal.detail.value);
}

function returnFromDetail(): void {
  const protectedChannel = journal.protectedDetail.value?.channel ?? protectedDetailChannel.value;
  if (protectedChannel) {
    const state = window.history.state as { journalDetailFromFeed?: boolean } | null;
    if (state?.journalDetailFromFeed === true) {
      router.back();
      return;
    }
    void router.push(publicFeedPath(protectedChannel));
    return;
  }
  emit('returnToFeed');
}

function handleInteractionsChange(summary: JournalInteractionSummary): void {
  const entry = journal.detail.value;
  if (!entry) return;
  journal.replacePublicInteractions(entry.publicId, summary);
  emit('interactionsChange', entry.publicId, summary);
}
</script>

<template>
  <JournalPullRefresh
    v-model="refreshing"
    :allow-overflow="true"
    :disabled="true"
  >
    <main class="feed feed--detail">
      <div class="feed__detail-heading">
        <button class="text-button" type="button" @click="returnFromDetail">← 返回信息流</button>
        <span>永久记录</span>
      </div>

      <div class="feed__reading-stage" :aria-busy="detailPreparing">
        <Transition name="feed-stage" mode="out-in">
          <JournalLoading v-if="deferredDetailLoading.visible.value && !journal.error.value" key="loading" variant="reading" label="正在展开记录…" />
          <ProtectedEntryUnlock
            v-else-if="journal.protectedDetail.value"
            key="protected-detail"
            :entry="journal.protectedDetail.value"
            :busy="journal.unlocking.value"
            :error="journal.unlockError.value"
            @unlock="unlockDetail"
          />
          <ArticleCardContent
            v-else-if="journal.detail.value && isArticleEntry(journal.detail.value)"
            key="article-detail"
            :entry="journal.detail.value"
            :linkable="false"
            display="full"
            anchored
            show-year
            @select-tag="selectTag"
          />
          <EntryCard
            v-else-if="journal.detail.value"
            key="entry-detail"
            :entry="journal.detail.value"
            :linkable="false"
            show-year
            @select-tag="selectTag"
          />
          <div v-else key="reserve" class="feed__reading-reserve" aria-hidden="true"></div>
        </Transition>

        <JournalInteractions
          v-if="journal.detail.value && !journal.error.value"
          :key="journal.detail.value.publicId"
          class="feed__detail-interactions"
          :entry="journal.detail.value"
          mode="public"
          :focus-on-mount="route.hash === '#comments'"
          @summary-change="handleInteractionsChange"
        />
      </div>
    </main>
  </JournalPullRefresh>
</template>

<style scoped>
.feed {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.feed--detail {
  width: min(calc(100% - (var(--page-gutter) * 2)), 1100px);
}

.feed__detail-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.feed__reading-stage,
.feed__reading-reserve {
  min-height: clamp(20rem, 48vh, 34rem);
}

.feed__reading-stage {
  display: grid;
}

.feed__detail-interactions {
  padding: 1.5rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.feed-stage-enter-active {
  transition: opacity var(--dur-content-enter) var(--ease-card), transform var(--dur-content-enter) var(--ease-card);
}

.feed-stage-leave-active {
  transition: opacity var(--dur-loading-exit) var(--ease-card);
}

.feed-stage-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.feed-stage-leave-to {
  opacity: 0;
}

@media (max-width: 599px) {
  .feed__detail-interactions {
    padding: 1rem;
  }
}
</style>
