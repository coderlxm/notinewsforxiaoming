<script setup lang="ts">
import { computed } from 'vue';
import GuestbookItem from './GuestbookItem.vue';
import type {
  GuestbookMessage,
  GuestbookStatus,
} from '../../../../src/shared/guestbookProtocol';

const props = defineProps<{
  messages: readonly GuestbookMessage[] | null;
  loading: boolean;
  loadError: string | null;
  ownerMode: boolean;
  mutatingId: number | null;
  submittingReply: boolean;
  replyTargetId: number | null;
}>();

const emit = defineEmits<{
  openReply: [parentId: number];
  closeReply: [];
  reply: [parentId: number, content: string];
  setStatus: [id: number, status: GuestbookStatus];
  setPinned: [id: number, pinned: boolean];
  remove: [id: number];
}>();

const showSkeleton = computed(() =>
  props.loading || (props.messages === null && props.loadError === null),
);

function isMessageBusy(message: GuestbookMessage): boolean {
  if (props.mutatingId === null) return false;
  return props.mutatingId === message.id
    || message.replies.some(reply => reply.id === props.mutatingId);
}
</script>

<template>
  <div class="guestbook-list-container" aria-live="polite">
    <!-- 纸质书信多列骨架屏 -->
    <div v-if="showSkeleton" class="guestbook-list__grid" aria-hidden="true">
      <div v-for="index in 6" :key="index" class="guestbook-list__skeleton-card">
        <div class="guestbook-list__skeleton-head">
          <span class="guestbook-list__skeleton-avatar" />
          <span class="guestbook-list__skeleton-line guestbook-list__skeleton-line--name" />
        </div>
        <div class="guestbook-list__skeleton-lines">
          <span class="guestbook-list__skeleton-line" />
          <span class="guestbook-list__skeleton-line guestbook-list__skeleton-line--long" />
          <span class="guestbook-list__skeleton-line guestbook-list__skeleton-line--short" />
        </div>
      </div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="loadError !== null" class="guestbook-list__state guestbook-list__state--error" role="alert">
      <h2>信箱加载异常</h2>
      <p>{{ loadError }}</p>
    </div>

    <!-- 空状态：书卷信箱插画 -->
    <div v-else-if="messages !== null && messages.length === 0" class="guestbook-list__empty">
      <div class="guestbook-list__empty-stamp" aria-hidden="true">✉</div>
      <h3 class="guestbook-list__empty-title">暂无来信 · 墨香尚温</h3>
      <p class="guestbook-list__empty-desc">信箱刚刚开启，期待你成为第一位在此留下墨迹的来访者。</p>
    </div>

    <!-- 正常信笺多列自适应画廊 -->
    <div v-else-if="messages !== null" class="guestbook-list__grid">
      <GuestbookItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :owner-mode="ownerMode"
        :busy="isMessageBusy(message)"
        :actions-disabled="mutatingId !== null || submittingReply"
        :reply-open="replyTargetId === message.id"
        :submitting-reply="submittingReply"
        @open-reply="emit('openReply', message.id)"
        @close-reply="emit('closeReply')"
        @submit-reply="emit('reply', message.id, $event)"
        @set-status="(id, status) => emit('setStatus', id, status)"
        @set-pinned="(id, pinned) => emit('setPinned', id, pinned)"
        @remove="id => emit('remove', id)"
      />
    </div>
  </div>
</template>

<style scoped>
.guestbook-list-container {
  width: 100%;
}

/* 多列自适应网格画廊 */
.guestbook-list__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: clamp(1rem, 2vw, 1.4rem);
  align-items: start;
}

/* 骨架屏 */
.guestbook-list__skeleton-card {
  display: grid;
  gap: 0.9rem;
  padding: 1.25rem 1.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.guestbook-list__skeleton-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.guestbook-list__skeleton-avatar {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 50%;
  background: var(--surface-muted);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-list__skeleton-lines {
  display: grid;
  gap: 0.55rem;
}

.guestbook-list__skeleton-line {
  height: 0.75rem;
  border-radius: 999px;
  background: var(--surface-muted);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-list__skeleton-line--name {
  width: 35%;
}

.guestbook-list__skeleton-line--short {
  width: 45%;
}

.guestbook-list__skeleton-line--long {
  width: 85%;
}

.guestbook-list__state {
  display: grid;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.guestbook-list__state h2,
.guestbook-list__state p {
  margin: 0;
}

.guestbook-list__state h2 {
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.guestbook-list__state p {
  color: var(--text-muted);
  font-size: 0.86rem;
  line-height: 1.7;
}

.guestbook-list__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.guestbook-list__state--error h2,
.guestbook-list__state--error p {
  color: var(--danger);
}

/* 空状态卡片 */
.guestbook-list__empty {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  padding: clamp(2.6rem, 6vw, 4rem) 1.5rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--surface-card) 50%, transparent);
  text-align: center;
}

.guestbook-list__empty-stamp {
  font-size: 2rem;
  line-height: 1;
  color: var(--accent);
  margin-bottom: 0.2rem;
}

.guestbook-list__empty-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.guestbook-list__empty-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.6;
}

@keyframes guestbook-skeleton-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.45;
  }
}

@media (max-width: 599px) {
  .guestbook-list__grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guestbook-list__skeleton-avatar,
  .guestbook-list__skeleton-line {
    animation: none;
  }
}
</style>
