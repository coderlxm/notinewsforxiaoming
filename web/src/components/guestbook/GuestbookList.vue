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
  <section class="guestbook-list" aria-live="polite">
    <div v-if="showSkeleton" class="guestbook-list__skeleton" aria-hidden="true">
      <div v-for="index in 3" :key="index" class="guestbook-list__skeleton-card">
        <span class="guestbook-list__skeleton-avatar" />
        <div class="guestbook-list__skeleton-lines">
          <span class="guestbook-list__skeleton-line guestbook-list__skeleton-line--short" />
          <span class="guestbook-list__skeleton-line" />
          <span class="guestbook-list__skeleton-line guestbook-list__skeleton-line--long" />
        </div>
      </div>
    </div>

    <div v-else-if="loadError !== null" class="guestbook-list__state guestbook-list__state--error" role="alert">
      <h2>留言没有加载完成</h2>
      <p>{{ loadError }}</p>
    </div>

    <p v-else-if="messages !== null && messages.length === 0" class="guestbook-list__empty">
      这里还很安静，来留下第一句话吧。
    </p>

    <template v-else-if="messages !== null">
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
    </template>
  </section>
</template>

<style scoped>
.guestbook-list {
  display: grid;
  gap: 0.9rem;
}

.guestbook-list__skeleton {
  display: grid;
  gap: 0.9rem;
}

.guestbook-list__skeleton-card {
  display: flex;
  gap: 0.7rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.guestbook-list__skeleton-avatar {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 50%;
  background: var(--surface-muted);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-list__skeleton-lines {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.5rem;
}

.guestbook-list__skeleton-line {
  height: 0.7rem;
  border-radius: 999px;
  background: var(--surface-muted);
  animation: guestbook-skeleton-pulse 1.4s ease-in-out infinite;
}

.guestbook-list__skeleton-line--short {
  width: 38%;
}

.guestbook-list__skeleton-line--long {
  width: 72%;
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
  font-size: 1.05rem;
}

.guestbook-list__state p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}

.guestbook-list__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.guestbook-list__state--error h2,
.guestbook-list__state--error p {
  color: var(--danger);
}

.guestbook-list__empty {
  margin: 0;
  padding: clamp(1.6rem, 5vw, 2.6rem);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-card);
  color: var(--text-muted);
  font-size: 0.86rem;
  text-align: center;
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

@media (prefers-reduced-motion: reduce) {
  .guestbook-list__skeleton-avatar,
  .guestbook-list__skeleton-line {
    animation: none;
  }
}
</style>
