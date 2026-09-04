<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useSiteProfileStore } from '../../stores/siteProfile';
import { formatEntryTime } from '../../utils/formatters';
import JournalCommentForm from '../interaction/JournalCommentForm.vue';
import type {
  GuestbookMessage,
  GuestbookStatus,
} from '../../../../src/shared/guestbookProtocol';

const props = withDefaults(defineProps<{
  message: GuestbookMessage;
  ownerMode: boolean;
  busy: boolean;
  actionsDisabled?: boolean;
  replyOpen: boolean;
  submittingReply: boolean;
}>(), {
  actionsDisabled: false,
});

const emit = defineEmits<{
  openReply: [];
  closeReply: [];
  submitReply: [content: string];
  setStatus: [id: number, status: GuestbookStatus];
  setPinned: [id: number, pinned: boolean];
  remove: [id: number];
}>();

const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);
const confirmingDeletionId = shallowRef<number | null>(null);

const isHidden = computed(() => 'status' in props.message && props.message.status === 'hidden');
const avatarCharacter = computed(() => {
  const characters = [...props.message.authorName.trim()];
  return characters.length > 0 ? characters[0]! : '?';
});
const avatarPaletteIndex = computed(() => {
  const characters = [...props.message.authorName.trim()];
  const total = characters.reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return total % 6;
});
const ownerAvatar = computed(() => (profile.value ? profile.value.avatarUrl : null));

function replyCharacter(replyAuthorName: string): string {
  const characters = [...replyAuthorName.trim()];
  return characters.length > 0 ? characters[0]! : '?';
}

function replyPaletteIndex(replyAuthorName: string): number {
  const characters = [...replyAuthorName.trim()];
  const total = characters.reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return total % 6;
}

function isReplyHidden(reply: { status?: string }): boolean {
  return reply.status === 'hidden';
}

function requestDeletion(id: number): void {
  confirmingDeletionId.value = id;
}

function cancelDeletion(): void {
  confirmingDeletionId.value = null;
}

function confirmDeletion(): void {
  const id = confirmingDeletionId.value;
  confirmingDeletionId.value = null;
  if (id !== null) emit('remove', id);
}
</script>

<template>
  <article
    class="guestbook-item"
    :class="{
      'guestbook-item--hidden': isHidden,
      'guestbook-item--busy': busy,
    }"
    :aria-busy="busy"
  >
    <span class="guestbook-item__avatar" :class="`guestbook-item__avatar--${avatarPaletteIndex}`" aria-hidden="true">
      {{ avatarCharacter }}
    </span>

    <div class="guestbook-item__body">
      <header class="guestbook-item__header">
        <span class="guestbook-item__author">{{ message.authorName }}</span>
        <span v-if="message.pinned" class="guestbook-item__badge">置顶</span>
        <span v-if="ownerMode && isHidden" class="guestbook-item__hidden-mark">已隐藏</span>
        <time class="guestbook-item__time" :datetime="message.createdAt">
          {{ formatEntryTime(message.createdAt) }}
        </time>

        <div
          v-if="ownerMode && confirmingDeletionId !== message.id"
          class="guestbook-item__actions"
        >
          <button
            type="button"
            class="guestbook-item__action"
            :disabled="actionsDisabled"
            @click="replyOpen ? emit('closeReply') : emit('openReply')"
          >
            {{ replyOpen ? '取消回复' : '回复' }}
          </button>
          <button
            type="button"
            class="guestbook-item__action"
            :disabled="actionsDisabled"
            @click="emit('setPinned', message.id, !message.pinned)"
          >
            {{ message.pinned ? '取消置顶' : '置顶' }}
          </button>
          <button
            type="button"
            class="guestbook-item__action"
            :disabled="actionsDisabled"
            @click="emit('setStatus', message.id, isHidden ? 'published' : 'hidden')"
          >
            {{ isHidden ? '恢复' : '隐藏' }}
          </button>
          <button
            type="button"
            class="guestbook-item__action guestbook-item__action--danger"
            :disabled="actionsDisabled"
            @click="requestDeletion(message.id)"
          >
            删除
          </button>
        </div>
      </header>

      <div
        v-if="ownerMode && confirmingDeletionId === message.id"
        class="guestbook-item__confirm"
        role="alert"
      >
        <span>永久删除这条留言及其全部回复？</span>
        <button
          type="button"
          class="guestbook-item__action"
          :disabled="actionsDisabled"
          @click="cancelDeletion"
        >
          取消
        </button>
        <button
          type="button"
          class="guestbook-item__action guestbook-item__action--danger"
          :disabled="actionsDisabled"
          @click="confirmDeletion"
        >
          确认删除
        </button>
      </div>

      <div class="guestbook-item__content" v-html="message.contentHtml" />

      <div v-if="message.replies.length > 0" class="guestbook-item__replies">
        <article
          v-for="reply in message.replies"
          :key="reply.id"
          class="guestbook-reply"
          :class="{ 'guestbook-reply--hidden': isReplyHidden(reply) }"
        >
          <img
            v-if="ownerAvatar"
            class="guestbook-reply__avatar guestbook-reply__avatar--profile"
            :src="ownerAvatar"
            alt=""
            width="28"
            height="28"
          >
          <span
            v-else
            class="guestbook-reply__avatar"
            :class="`guestbook-reply__avatar--${replyPaletteIndex(reply.authorName)}`"
            aria-hidden="true"
          >
            {{ replyCharacter(reply.authorName) }}
          </span>

          <div class="guestbook-reply__body">
            <header class="guestbook-reply__header">
              <span class="guestbook-reply__author">{{ reply.authorName }}</span>
              <span class="guestbook-reply__badge">博主</span>
              <span
                v-if="ownerMode && isReplyHidden(reply)"
                class="guestbook-reply__hidden-mark"
              >
                已隐藏
              </span>
              <time class="guestbook-reply__time" :datetime="reply.createdAt">
                {{ formatEntryTime(reply.createdAt) }}
              </time>

              <div v-if="ownerMode" class="guestbook-reply__actions">
                <button
                  type="button"
                  class="guestbook-item__action"
                  :disabled="actionsDisabled"
                  @click="emit('setStatus', reply.id, isReplyHidden(reply) ? 'published' : 'hidden')"
                >
                  {{ isReplyHidden(reply) ? '恢复' : '隐藏' }}
                </button>
                <button
                  v-if="confirmingDeletionId !== reply.id"
                  type="button"
                  class="guestbook-item__action guestbook-item__action--danger"
                  :disabled="actionsDisabled"
                  @click="requestDeletion(reply.id)"
                >
                  删除
                </button>
              </div>
            </header>

            <div
              v-if="confirmingDeletionId === reply.id"
              class="guestbook-item__confirm"
              role="alert"
            >
              <span>永久删除这条回复？</span>
              <button
                type="button"
                class="guestbook-item__action"
                :disabled="actionsDisabled"
                @click="cancelDeletion"
              >
                取消
              </button>
              <button
                type="button"
                class="guestbook-item__action guestbook-item__action--danger"
                :disabled="actionsDisabled"
                @click="confirmDeletion"
              >
                确认删除
              </button>
            </div>

            <div class="guestbook-item__content guestbook-reply__content" v-html="reply.contentHtml" />
          </div>
        </article>
      </div>

      <JournalCommentForm
        v-if="replyOpen"
        class="guestbook-item__reply-form"
        mode="owner"
        :busy="submittingReply"
        :disabled="actionsDisabled"
        :reply-to-name="message.authorName"
        @submit="emit('submitReply', $event.content)"
      />
    </div>
  </article>
</template>

<style scoped>
.guestbook-item {
  display: flex;
  gap: 0.7rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  transition: border-color 180ms ease;
}

.guestbook-item--hidden .guestbook-item__content,
.guestbook-item--hidden .guestbook-item__avatar,
.guestbook-item--hidden .guestbook-item__author {
  opacity: 0.62;
}

.guestbook-item__avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.guestbook-item__avatar--0 {
  background: #e9e2d4;
  color: #6b5f47;
}

.guestbook-item__avatar--1 {
  background: #dde6dd;
  color: #4d6350;
}

.guestbook-item__avatar--2 {
  background: #e0e2ec;
  color: #525a78;
}

.guestbook-item__avatar--3 {
  background: #ecdfd9;
  color: #7a5245;
}

.guestbook-item__avatar--4 {
  background: #e5e0ea;
  color: #5e5273;
}

.guestbook-item__avatar--5 {
  background: #dfe7ea;
  color: #46606b;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--0 {
  background: #3b3730;
  color: #cfc3a8;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--1 {
  background: #313b32;
  color: #b2c6b6;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--2 {
  background: #32353f;
  color: #b3bacf;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--3 {
  background: #3d322d;
  color: #d3aca0;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--4 {
  background: #37323d;
  color: #c2b4d3;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--5 {
  background: #2e373a;
  color: #a9c0c9;
}

.guestbook-item__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.3rem;
}

.guestbook-item__header {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.guestbook-item__author {
  color: var(--text-primary);
  font-size: 0.86rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-item__badge {
  flex: none;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.3;
}

.guestbook-item__hidden-mark {
  flex: none;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.guestbook-item__time {
  margin-left: auto;
  flex: none;
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.guestbook-item__actions,
.guestbook-reply__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.1rem;
  opacity: 0;
  transition: opacity 140ms ease;
}

.guestbook-item__header:focus-within .guestbook-item__actions,
.guestbook-item:hover .guestbook-item__actions,
.guestbook-reply__header:focus-within .guestbook-reply__actions,
.guestbook-reply:hover .guestbook-reply__actions {
  opacity: 1;
}

@media (hover: none) {
  .guestbook-item__actions,
  .guestbook-reply__actions {
    opacity: 1;
  }
}

.guestbook-item__action {
  padding: 0.25rem 0.4rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  white-space: nowrap;
}

.guestbook-item__action:hover:not(:disabled) {
  color: var(--text-primary);
}

.guestbook-item__action--danger:hover:not(:disabled) {
  color: var(--danger);
}

.guestbook-item__action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-radius: 0.35rem;
}

.guestbook-item__action:disabled {
  cursor: default;
  opacity: 0.6;
}

.guestbook-item__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.55rem;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.76rem;
}

.guestbook-item__content {
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.guestbook-item__content :deep(p) {
  margin: 0 0 0.4rem;
}

.guestbook-item__content :deep(p:last-child) {
  margin-bottom: 0;
}

.guestbook-item__content :deep(a) {
  color: var(--accent-strong);
}

.guestbook-item__content :deep(code) {
  padding: 0.05rem 0.3rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-size: 0.82em;
}

.guestbook-item__content :deep(pre) {
  margin: 0.4rem 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.55rem;
  background: var(--surface-muted);
  overflow-x: auto;
}

.guestbook-item__content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.guestbook-item__content :deep(blockquote) {
  margin: 0.4rem 0;
  padding-left: 0.65rem;
  border-left: 2px solid var(--border-strong);
  color: var(--text-muted);
}

.guestbook-item__content :deep(ul),
.guestbook-item__content :deep(ol) {
  margin: 0.4rem 0;
  padding-left: 1.25rem;
}

.guestbook-item__replies {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.35rem;
  padding-left: 0.9rem;
  border-left: 1px solid var(--border-subtle);
}

.guestbook-reply {
  display: flex;
  gap: 0.5rem;
  min-width: 0;
}

.guestbook-reply--hidden .guestbook-reply__content,
.guestbook-reply--hidden .guestbook-reply__avatar,
.guestbook-reply--hidden .guestbook-reply__author {
  opacity: 0.62;
}

.guestbook-reply__avatar {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.guestbook-reply__avatar--profile {
  object-fit: cover;
}

.guestbook-reply__avatar--0 {
  background: #e9e2d4;
  color: #6b5f47;
}

.guestbook-reply__avatar--1 {
  background: #dde6dd;
  color: #4d6350;
}

.guestbook-reply__avatar--2 {
  background: #e0e2ec;
  color: #525a78;
}

.guestbook-reply__avatar--3 {
  background: #ecdfd9;
  color: #7a5245;
}

.guestbook-reply__avatar--4 {
  background: #e5e0ea;
  color: #5e5273;
}

.guestbook-reply__avatar--5 {
  background: #dfe7ea;
  color: #46606b;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--0 {
  background: #3b3730;
  color: #cfc3a8;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--1 {
  background: #313b32;
  color: #b2c6b6;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--2 {
  background: #32353f;
  color: #b3bacf;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--3 {
  background: #3d322d;
  color: #d3aca0;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--4 {
  background: #37323d;
  color: #c2b4d3;
}

:global(html[data-theme='dark']) .guestbook-reply__avatar--5 {
  background: #2e373a;
  color: #a9c0c9;
}

.guestbook-reply__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.2rem;
}

.guestbook-reply__header {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.guestbook-reply__author {
  color: var(--text-primary);
  font-size: 0.82rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-reply__badge {
  flex: none;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.3;
}

.guestbook-reply__hidden-mark {
  flex: none;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.guestbook-reply__time {
  margin-left: auto;
  flex: none;
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.guestbook-reply__content {
  font-size: 0.86rem;
}

.guestbook-item__reply-form {
  margin-top: 0.35rem;
}

.guestbook-item--busy {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-subtle));
}

@media (max-width: 599px) {
  .guestbook-item {
    padding: 0.85rem;
  }

  .guestbook-item__actions {
    flex-basis: 100%;
    margin-left: -0.4rem;
    opacity: 1;
  }

  .guestbook-item__action {
    min-height: 40px;
  }

  .guestbook-item__replies {
    padding-left: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guestbook-item__actions,
  .guestbook-reply__actions {
    transition: none;
  }
}
</style>
