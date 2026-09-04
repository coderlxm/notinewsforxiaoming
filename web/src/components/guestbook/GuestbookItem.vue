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
      'guestbook-item--pinned': message.pinned,
      'guestbook-item--busy': busy,
    }"
    :aria-busy="busy"
  >
    <!-- 卡片顶部：头像 + 访客信息 + 时间戳 -->
    <header class="guestbook-item__header">
      <div class="guestbook-item__user">
        <span
          class="guestbook-item__avatar"
          :class="`guestbook-item__avatar--${avatarPaletteIndex}`"
          aria-hidden="true"
        >
          {{ avatarCharacter }}
        </span>

        <div class="guestbook-item__meta">
          <div class="guestbook-item__author-row">
            <span class="guestbook-item__author">{{ message.authorName }}</span>
            <span v-if="message.pinned" class="guestbook-item__badge-pinned">
              <span class="guestbook-item__badge-icon">📌</span>
              <span>置顶</span>
            </span>
            <span v-if="ownerMode && isHidden" class="guestbook-item__hidden-mark">已隐藏</span>
          </div>
          <time class="guestbook-item__time" :datetime="message.createdAt">
            <span>{{ formatEntryTime(message.createdAt) }}</span>
          </time>
        </div>
      </div>

      <!-- 博主管理菜单 -->
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
          {{ replyOpen ? '取消' : '回信' }}
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

    <!-- 删除确认提示 -->
    <div
      v-if="ownerMode && confirmingDeletionId === message.id"
      class="guestbook-item__confirm"
      role="alert"
    >
      <span>永久删除此信笺及其全部回信？</span>
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

    <!-- 信笺正文 -->
    <div class="guestbook-item__content" v-html="message.contentHtml" />

    <!-- 博主回信区域 -->
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
            <div class="guestbook-reply__meta">
              <span class="guestbook-reply__author">{{ reply.authorName }}</span>
              <span class="guestbook-reply__badge">博主</span>
              <span
                v-if="ownerMode && isReplyHidden(reply)"
                class="guestbook-reply__hidden-mark"
              >
                已隐藏
              </span>
            </div>

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
            <span>永久删除这条回信？</span>
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

    <!-- 回复输入框 -->
    <JournalCommentForm
      v-if="replyOpen"
      class="guestbook-item__reply-form"
      mode="owner"
      context="guestbook"
      :busy="submittingReply"
      :disabled="actionsDisabled"
      :reply-to-name="message.authorName"
      @submit="emit('submitReply', $event.content)"
    />
  </article>
</template>

<style scoped>
.guestbook-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: clamp(1.15rem, 2.5vw, 1.45rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
  min-width: 0;
  overflow-wrap: anywhere;
}

.guestbook-item:hover {
  transform: translateY(-2px);
  border-color: var(--border-strong);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
}

.guestbook-item--pinned {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-subtle));
  background: color-mix(in srgb, var(--surface-card) 97%, var(--accent-soft));
}

.guestbook-item--hidden .guestbook-item__content,
.guestbook-item--hidden .guestbook-item__avatar,
.guestbook-item--hidden .guestbook-item__author {
  opacity: 0.58;
}

/* 顶部信息行 */
.guestbook-item__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.6rem;
  min-width: 0;
}

.guestbook-item__user {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}

/* 纸质信笺首字母头像 */
.guestbook-item__avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.04);
}

/* 莫兰迪/大地信笺配色 */
.guestbook-item__avatar--0 {
  background: #f0e9df;
  color: #785b3a;
}

.guestbook-item__avatar--1 {
  background: #e2ece4;
  color: #3e6b4e;
}

.guestbook-item__avatar--2 {
  background: #e3e8f0;
  color: #41577a;
}

.guestbook-item__avatar--3 {
  background: #f2e3e1;
  color: #8a4943;
}

.guestbook-item__avatar--4 {
  background: #eee5f2;
  color: #6e487d;
}

.guestbook-item__avatar--5 {
  background: #e1ebed;
  color: #3b656e;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--0 {
  background: #383127;
  color: #e2d5c3;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--1 {
  background: #29382f;
  color: #b8d9c2;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--2 {
  background: #2a3444;
  color: #bccce5;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--3 {
  background: #3d2b2a;
  color: #e5bcb8;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--4 {
  background: #35293d;
  color: #d8c2e3;
}

:global(html[data-theme='dark']) .guestbook-item__avatar--5 {
  background: #27363a;
  color: #b5d6dc;
}

.guestbook-item__meta {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.guestbook-item__author-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.guestbook-item__author {
  color: var(--text-primary);
  font-size: 0.88rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-item__badge-pinned {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.08rem 0.4rem;
  border-radius: 4px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.2;
}

.guestbook-item__badge-icon {
  font-size: 0.6rem;
}

.guestbook-item__hidden-mark {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.guestbook-item__time {
  color: var(--text-muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.guestbook-item__actions,
.guestbook-reply__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.2rem;
  opacity: 0;
  transition: opacity 140ms ease;
}

.guestbook-item:hover .guestbook-item__actions,
.guestbook-item__header:focus-within .guestbook-item__actions,
.guestbook-reply:hover .guestbook-reply__actions,
.guestbook-reply__header:focus-within .guestbook-reply__actions {
  opacity: 1;
}

@media (hover: none) {
  .guestbook-item__actions,
  .guestbook-reply__actions {
    opacity: 1;
  }
}

.guestbook-item__action {
  padding: 0.18rem 0.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: var(--surface-card);
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.7rem;
  white-space: nowrap;
  transition: color 120ms ease, border-color 120ms ease;
}

.guestbook-item__action:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.guestbook-item__action--danger:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-soft);
}

.guestbook-item__action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
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
  padding: 0.35rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.55rem;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.76rem;
}

/* 正文书信 Markdown 排版 */
.guestbook-item__content {
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.7;
  letter-spacing: 0.01em;
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
  text-decoration: underline;
  text-underline-offset: 3px;
}

.guestbook-item__content :deep(code) {
  padding: 0.1rem 0.35rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-size: 0.84em;
}

.guestbook-item__content :deep(pre) {
  margin: 0.45rem 0;
  padding: 0.55rem 0.75rem;
  border-radius: 0.55rem;
  background: var(--surface-muted);
  overflow-x: auto;
}

.guestbook-item__content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.guestbook-item__content :deep(blockquote) {
  margin: 0.45rem 0;
  padding: 0.15rem 0 0.15rem 0.75rem;
  border-left: 2px solid var(--accent);
  color: var(--text-muted);
  font-style: italic;
}

.guestbook-item__content :deep(ul),
.guestbook-item__content :deep(ol) {
  margin: 0.45rem 0;
  padding-left: 1.3rem;
}

/* 博主回信卡片 */
.guestbook-item__replies {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.4rem;
}

.guestbook-reply {
  display: flex;
  gap: 0.65rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--accent);
  border-radius: 6px;
  background: var(--surface-muted);
}

.guestbook-reply--hidden .guestbook-reply__content,
.guestbook-reply--hidden .guestbook-reply__avatar,
.guestbook-reply--hidden .guestbook-reply__author {
  opacity: 0.58;
}

.guestbook-reply__avatar {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-weight: 700;
  line-height: 1;
  user-select: none;
}

.guestbook-reply__avatar--profile {
  object-fit: cover;
  border: 1px solid var(--border-strong);
}

.guestbook-reply__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.3rem;
}

.guestbook-reply__header {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.6rem;
}

.guestbook-reply__meta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.guestbook-reply__author {
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.guestbook-reply__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.38rem;
  border-radius: 3px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.64rem;
  font-weight: 700;
  line-height: 1.2;
}

.guestbook-reply__hidden-mark {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.guestbook-reply__time {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.guestbook-reply__content {
  font-size: 0.86rem;
  line-height: 1.65;
}

.guestbook-item__reply-form {
  margin-top: 0.5rem;
}

.guestbook-item--busy {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-subtle));
}

@media (max-width: 599px) {
  .guestbook-item {
    padding: 1rem;
  }

  .guestbook-item__actions {
    opacity: 1;
  }

  .guestbook-reply {
    padding: 0.75rem 0.85rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guestbook-item {
    transition: none;
  }

  .guestbook-item:hover {
    transform: none;
  }

  .guestbook-item__actions,
  .guestbook-reply__actions {
    transition: none;
  }
}
</style>
