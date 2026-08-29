<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, useTemplateRef } from 'vue';
import {
  useJournalInteractions,
  type InteractionComment,
} from '../../composables/useJournalInteractions';
import type { JournalEntry, JournalInteractionSummary } from '../../types';
import JournalCommentForm from './JournalCommentForm.vue';
import JournalCommentItem from './JournalCommentItem.vue';
import JournalReactionButton from './JournalReactionButton.vue';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  mode: 'public' | 'private';
  focusOnMount?: boolean;
}>(), {
  focusOnMount: false,
});

const emit = defineEmits<{
  summaryChange: [summary: JournalInteractionSummary];
}>();

const interactions = useJournalInteractions({
  mode: props.mode,
  entry: props.entry,
  onSummaryChange: (summary) => emit('summaryChange', summary),
});

const root = useTemplateRef<HTMLElement>('root');
const visitorForm = ref<InstanceType<typeof JournalCommentForm> | null>(null);
const replyForm = ref<InstanceType<typeof JournalCommentForm> | null>(null);
const replyTarget = shallowRef<InteractionComment | null>(null);

const commentCount = computed(() => interactions.summary.value.commentCount);

onMounted(() => {
  if (!props.focusOnMount) return;
  void nextTick(() => root.value?.scrollIntoView({ block: 'start' }));
});

async function handleVisitorSubmit(input: {
  authorName: string;
  content: string;
  website: string;
}): Promise<void> {
  const succeeded = await interactions.submitVisitorComment({
    authorName: input.authorName,
    content: input.content,
    website: input.website,
  });
  if (succeeded) visitorForm.value?.clearContent();
  else visitorForm.value?.markFailed();
}

async function handleReplySubmit(input: {
  authorName: string;
  content: string;
  website: string;
}): Promise<void> {
  const target = replyTarget.value;
  if (!target) return;
  const succeeded = await interactions.submitOwnerReply(target.id, input.content);
  if (succeeded) {
    replyForm.value?.clearContent();
    replyTarget.value = null;
  }
  else replyForm.value?.markFailed();
}
</script>

<template>
  <section
    id="comments"
    ref="root"
    class="journal-interactions"
    aria-label="互动区"
  >
    <div class="journal-interactions__reaction">
      <JournalReactionButton
        v-if="mode === 'public'"
        variant="detail"
        :reacted="interactions.summary.value.viewerReacted"
        :count="interactions.summary.value.reactionCount"
        :pending="interactions.reactionPending.value"
        @toggle="interactions.setReaction(!interactions.summary.value.viewerReacted)"
      />
      <span v-else class="journal-interactions__reaction-static">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          />
        </svg>
        <span>{{ interactions.summary.value.reactionCount }} 人觉得不错</span>
      </span>
    </div>

    <div class="journal-interactions__divider" role="presentation" />

    <h2 class="journal-interactions__title">
      讨论
      <span v-if="commentCount > 0" class="journal-interactions__title-count">{{ commentCount }}</span>
    </h2>

    <JournalCommentForm
      v-if="mode === 'public'"
      ref="visitorForm"
      mode="visitor"
      :busy="interactions.submittingComment.value"
      :initial-author-name="interactions.rememberedVisitorName"
      @submit="handleVisitorSubmit"
    />

    <div v-if="interactions.loadingComments.value && interactions.comments.value === null" class="journal-interactions__skeleton" aria-hidden="true">
      <span class="journal-interactions__skeleton-line" />
      <span class="journal-interactions__skeleton-line journal-interactions__skeleton-line--short" />
    </div>

    <TransitionGroup
      v-else-if="interactions.comments.value && interactions.comments.value.length"
      name="comment"
      tag="div"
      class="journal-interactions__comments"
    >
      <JournalCommentItem
        v-for="comment in interactions.comments.value"
        :key="comment.id"
        :comment="comment"
        :mode="mode"
        :busy="interactions.mutatingCommentId.value === comment.id"
        @reply="replyTarget = $event"
        @set-status="(target, status) => interactions.setCommentStatus(target.id, status)"
        @remove="interactions.removeComment($event.id)"
      >
        <template #replies>
          <JournalCommentItem
            v-for="reply in comment.replies"
            :key="reply.id"
            :comment="reply"
            :mode="mode"
            is-reply
            :busy="interactions.mutatingCommentId.value === reply.id"
            @set-status="(target, status) => interactions.setCommentStatus(target.id, status)"
            @remove="interactions.removeComment($event.id)"
          />
          <div v-if="replyTarget !== null && replyTarget.id === comment.id" class="journal-interactions__reply-form">
            <JournalCommentForm
              ref="replyForm"
              mode="owner"
              :busy="interactions.submittingComment.value"
              :reply-to-name="replyTarget.authorName"
              @submit="handleReplySubmit"
            />
            <button
              type="button"
              class="journal-interactions__reply-cancel"
              @click="replyTarget = null"
            >
              取消回复
            </button>
          </div>
        </template>
      </JournalCommentItem>
    </TransitionGroup>

    <p
      v-else-if="interactions.comments.value && interactions.comments.value.length === 0"
      class="journal-interactions__empty"
    >
      还没有评论，来抢沙发。
    </p>

    <div v-if="interactions.pendingComment.value" class="journal-interactions__pending" aria-busy="true">
      <span class="journal-interactions__pending-avatar" aria-hidden="true">
        {{ [...interactions.pendingComment.value.authorName.trim()][0] ?? '?' }}
      </span>
      <div class="journal-interactions__pending-body">
        <header class="journal-interactions__pending-header">
          <span class="journal-interactions__pending-author">
            {{ interactions.pendingComment.value.authorName }}
          </span>
          <span class="journal-interactions__pending-time">发送中…</span>
        </header>
        <p class="journal-interactions__pending-content">
          {{ interactions.pendingComment.value.content }}
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.journal-interactions {
  display: grid;
  gap: 0.85rem;
  margin-top: 1.6rem;
  min-width: 0;
  scroll-margin-top: 24px;
}

.journal-interactions__reaction {
  display: flex;
  align-items: center;
  min-height: 40px;
}

.journal-interactions__reaction-static {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.84rem;
}

.journal-interactions__reaction-static svg {
  width: 1.1em;
  height: 1.1em;
  fill: currentColor;
  stroke: none;
}

.journal-interactions__divider {
  height: 1px;
  background: var(--border-subtle);
}

.journal-interactions__title {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  font-size: 1.02rem;
  font-weight: 750;
}

.journal-interactions__title-count {
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.journal-interactions__skeleton {
  display: grid;
  gap: 0.55rem;
  padding: 0.4rem 0;
}

.journal-interactions__skeleton-line {
  width: 62%;
  height: 0.78rem;
  border-radius: 0.4rem;
  background: var(--surface-muted);
}

.journal-interactions__skeleton-line--short {
  width: 38%;
}

.journal-interactions__comments {
  display: grid;
  gap: 0.9rem;
}

.journal-interactions__empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.journal-interactions__reply-form {
  display: grid;
  gap: 0.3rem;
  margin-top: 0.5rem;
}

.journal-interactions__reply-cancel {
  justify-self: start;
  padding: 0.2rem 0.3rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
}

.journal-interactions__reply-cancel:hover {
  color: var(--text-primary);
}

.journal-interactions__reply-cancel:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-radius: 0.35rem;
}

.journal-interactions__pending {
  display: flex;
  gap: 0.6rem;
  opacity: 0.75;
}

.journal-interactions__pending-avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
}

.journal-interactions__pending-body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.2rem;
}

.journal-interactions__pending-header {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.journal-interactions__pending-author {
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 650;
}

.journal-interactions__pending-time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.journal-interactions__pending-content {
  margin: 0;
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.comment-enter-active {
  transition:
    opacity 160ms ease,
    transform 160ms var(--ease-card);
}

.comment-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .comment-enter-active {
    transition: none;
  }
}
</style>
