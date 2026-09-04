<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, shallowRef, useTemplateRef } from 'vue';
import type { GuestbookStatus } from '../../../../src/shared/guestbookProtocol';
import {
  useGuestbookStore,
  type GuestbookScope,
} from '../../stores/guestbook';
import { useSessionStore } from '../../stores/session';
import {
  getOrCreateJournalVisitorId,
  getRememberedJournalVisitorName,
  rememberJournalVisitorName,
} from '../../utils/journalVisitorIdentity';
import { showMessage } from '../../utils/message';
import JournalCommentForm from '../interaction/JournalCommentForm.vue';
import GuestbookHeader from './GuestbookHeader.vue';
import GuestbookList from './GuestbookList.vue';

interface JournalCommentFormInstance {
  clearContent: () => void;
  markFailed: () => void;
}

const session = useSessionStore();
const guestbook = useGuestbookStore();
const {
  messages,
  loadedScope,
  loading,
  loadError,
  submittingVisitor,
  submittingReply,
  mutatingId,
} = storeToRefs(guestbook);
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);

const replyTargetId = shallowRef<number | null>(null);
const rememberedVisitorName = getRememberedJournalVisitorName();
const visitorForm = useTemplateRef<JournalCommentFormInstance>('visitorForm');

const ownerMode = computed(() => authenticationChecked.value && ownerAuthenticated.value);
const scope = computed<GuestbookScope | null>(() => {
  if (!authenticationChecked.value) return null;
  return ownerAuthenticated.value ? 'admin' : 'public';
});
const renderedMessages = computed(() =>
  scope.value !== null && loadedScope.value === scope.value ? messages.value : null,
);
const renderedLoadError = computed(() => {
  if (scope.value === null) return authenticationError.value;
  return loadedScope.value === scope.value ? loadError.value : null;
});
const renderedLoading = computed(() =>
  renderedLoadError.value === null
  && (scope.value === null || loadedScope.value !== scope.value || loading.value),
);
const total = computed(() =>
  renderedMessages.value === null ? null : renderedMessages.value.length,
);
const repliedTotal = computed(() => {
  if (renderedMessages.value === null) return 0;
  return renderedMessages.value.filter(m => m.replies && m.replies.length > 0).length;
});
const hiddenTotal = computed(() => {
  if (!ownerMode.value || renderedMessages.value === null) return null;
  return renderedMessages.value.filter(
    message => 'status' in message && message.status === 'hidden',
  ).length;
});
const visitorFormDisabled = computed(() =>
  renderedLoading.value || renderedLoadError.value !== null);

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

onMounted(() => {
  void initialize();
});

async function initialize(): Promise<void> {
  await session.load();
  if (!authenticationChecked.value) return;
  await guestbook.ensureLoaded(ownerAuthenticated.value ? 'admin' : 'public');
}

async function handleVisitorSubmit(input: {
  authorName: string;
  content: string;
  website: string;
}): Promise<void> {
  const visitorId = getOrCreateJournalVisitorId();
  if (visitorId === null) {
    showMessage({ message: '浏览器匿名身份不可用，无法发送留言。', type: 'error' });
    visitorForm.value?.markFailed();
    return;
  }
  try {
    await guestbook.createVisitorMessage(input, visitorId);
    rememberJournalVisitorName(input.authorName);
    visitorForm.value?.clearContent();
    showMessage({ message: '留言已发送', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
    visitorForm.value?.markFailed();
  }
}

function openReply(parentId: number): void {
  replyTargetId.value = parentId;
}

function closeReply(): void {
  replyTargetId.value = null;
}

async function handleReplySubmit(parentId: number, content: string): Promise<void> {
  try {
    await guestbook.createOwnerReply(parentId, content);
    replyTargetId.value = null;
    showMessage({ message: '回复已发送', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleSetStatus(id: number, status: GuestbookStatus): Promise<void> {
  try {
    await guestbook.setStatus(id, status);
    showMessage({ message: status === 'hidden' ? '已隐藏' : '已恢复公开', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleSetPinned(id: number, pinned: boolean): Promise<void> {
  try {
    await guestbook.setPinned(id, pinned);
    showMessage({ message: pinned ? '已置顶' : '已取消置顶', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}

async function handleRemove(id: number): Promise<void> {
  try {
    await guestbook.remove(id);
    if (replyTargetId.value === id) replyTargetId.value = null;
    showMessage({ message: '已删除', type: 'success' });
  }
  catch (reason) {
    showMessage({ message: errorMessage(reason), type: 'error' });
  }
}
</script>

<template>
  <main class="guestbook-view">
    <!-- 顶部看板 -->
    <GuestbookHeader
      :total="total"
      :replied-total="repliedTotal"
      :hidden-total="hiddenTotal"
      :owner-mode="ownerMode"
    />

    <!-- 访客留言输入框 -->
    <section v-if="!ownerMode" class="guestbook-view__composer" aria-label="写留言">
      <JournalCommentForm
        v-if="authenticationChecked"
        ref="visitorForm"
        mode="visitor"
        context="guestbook"
        :busy="submittingVisitor"
        :disabled="visitorFormDisabled"
        :initial-author-name="rememberedVisitorName"
        @submit="handleVisitorSubmit"
      />
    </section>

    <!-- 下方多列自适应留言列表 -->
    <section class="guestbook-view__list" aria-label="留言列表">
      <GuestbookList
        :messages="renderedMessages"
        :loading="renderedLoading"
        :load-error="renderedLoadError"
        :owner-mode="ownerMode"
        :mutating-id="mutatingId"
        :submitting-reply="submittingReply"
        :reply-target-id="replyTargetId"
        @open-reply="openReply"
        @close-reply="closeReply"
        @reply="handleReplySubmit"
        @set-status="handleSetStatus"
        @set-pinned="handleSetPinned"
        @remove="handleRemove"
      />
    </section>
  </main>
</template>

<style scoped>
.guestbook-view {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 1360px);
  margin: 0 auto;
  padding: clamp(2.2rem, 4.5vw, 3.8rem) 0 5.5rem;
  gap: clamp(1.4rem, 2.5vw, 2rem);
  align-content: start;
}

.guestbook-view__composer {
  width: 100%;
}

.guestbook-view__list {
  width: 100%;
}

@media (max-width: 599px) {
  .guestbook-view {
    padding: 1.6rem 0 calc(2.4rem + env(safe-area-inset-bottom));
    gap: 1.2rem;
  }
}
</style>
