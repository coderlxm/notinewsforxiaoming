<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type {
  JournalAdminComment,
  JournalPublicComment,
} from '../../types';
import { formatEntryTime } from '../../utils/formatters';

const props = withDefaults(defineProps<{
  comment: JournalPublicComment | JournalAdminComment;
  mode: 'public' | 'private';
  isReply?: boolean;
  busy?: boolean;
}>(), {
  isReply: false,
  busy: false,
});

const emit = defineEmits<{
  reply: [comment: JournalPublicComment | JournalAdminComment];
  setStatus: [comment: JournalPublicComment | JournalAdminComment, status: 'published' | 'hidden'];
  remove: [comment: JournalPublicComment | JournalAdminComment];
}>();

const siteProfile = useSiteProfileStore();
const { profile } = storeToRefs(siteProfile);
const confirmingDeletion = shallowRef(false);

const isOwner = computed(() => props.comment.authorRole === 'owner');
const isHidden = computed(() => 'status' in props.comment && props.comment.status === 'hidden');
const avatarCharacter = computed(() => {
  const name = props.comment.authorName.trim();
  const characters = [...name];
  return characters.length > 0 ? characters[0]! : '?';
});
const avatarPaletteIndex = computed(() => {
  const characters = [...props.comment.authorName.trim()];
  const total = characters.reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0);
  return total % 6;
});
const avatarClasses = computed(() => [
  `comment-item__avatar--${avatarPaletteIndex.value}`,
  { 'comment-item__avatar--owner': isOwner.value },
]);

function requestDeletion(): void {
  confirmingDeletion.value = true;
}

function cancelDeletion(): void {
  confirmingDeletion.value = false;
}

function confirmDeletion(): void {
  confirmingDeletion.value = false;
  emit('remove', props.comment);
}
</script>

<template>
  <article
    class="comment-item"
    :class="{
      'comment-item--reply': isReply,
      'comment-item--hidden': isHidden,
      'comment-item--owner': isOwner,
    }"
  >
    <img
      v-if="isOwner && profile"
      class="comment-item__avatar comment-item__avatar--profile"
      :src="profile.avatarUrl"
      alt=""
      width="34"
      height="34"
    >
    <span v-else class="comment-item__avatar" :class="avatarClasses" aria-hidden="true">
      {{ avatarCharacter }}
    </span>

    <div class="comment-item__body">
      <header class="comment-item__header">
        <span class="comment-item__author">{{ comment.authorName }}</span>
        <span v-if="isOwner" class="comment-item__badge">作者</span>
        <span v-if="isHidden" class="comment-item__hidden-mark">已隐藏</span>
        <time class="comment-item__time" :datetime="comment.createdAt">
          {{ formatEntryTime(comment.createdAt) }}
        </time>

        <div v-if="mode === 'private' && !confirmingDeletion" class="comment-item__actions">
          <button
            v-if="!isReply"
            type="button"
            class="comment-item__action"
            :disabled="busy"
            @click="emit('reply', comment)"
          >
            回复
          </button>
          <button
            type="button"
            class="comment-item__action"
            :disabled="busy"
            @click="emit('setStatus', comment, isHidden ? 'published' : 'hidden')"
          >
            {{ isHidden ? '恢复' : '隐藏' }}
          </button>
          <button
            type="button"
            class="comment-item__action comment-item__action--danger"
            :disabled="busy"
            @click="requestDeletion"
          >
            删除
          </button>
        </div>
      </header>

      <div v-if="mode === 'private' && confirmingDeletion" class="comment-item__confirm" role="alert">
        <span>永久删除这条评论？</span>
        <button type="button" class="comment-item__action" :disabled="busy" @click="cancelDeletion">
          取消
        </button>
        <button
          type="button"
          class="comment-item__action comment-item__action--danger"
          :disabled="busy"
          @click="confirmDeletion"
        >
          确认删除
        </button>
      </div>

      <div class="comment-item__content" v-html="comment.contentHtml" />

      <div v-if="$slots.replies" class="comment-item__replies">
        <slot name="replies" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.comment-item {
  display: flex;
  gap: 0.6rem;
  min-width: 0;
}

.comment-item__avatar {
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

.comment-item__avatar--profile {
  object-fit: cover;
}

.comment-item__avatar--0 {
  background: #e9e2d4;
  color: #6b5f47;
}

.comment-item__avatar--1 {
  background: #dde6dd;
  color: #4d6350;
}

.comment-item__avatar--2 {
  background: #e0e2ec;
  color: #525a78;
}

.comment-item__avatar--3 {
  background: #ecdfd9;
  color: #7a5245;
}

.comment-item__avatar--4 {
  background: #e5e0ea;
  color: #5e5273;
}

.comment-item__avatar--5 {
  background: #dfe7ea;
  color: #46606b;
}

:global(html[data-theme='dark']) .comment-item__avatar--0 {
  background: #3b3730;
  color: #cfc3a8;
}

:global(html[data-theme='dark']) .comment-item__avatar--1 {
  background: #313b32;
  color: #b2c6b6;
}

:global(html[data-theme='dark']) .comment-item__avatar--2 {
  background: #32353f;
  color: #b3bacf;
}

:global(html[data-theme='dark']) .comment-item__avatar--3 {
  background: #3d322d;
  color: #d3aca0;
}

:global(html[data-theme='dark']) .comment-item__avatar--4 {
  background: #37323d;
  color: #c2b4d3;
}

:global(html[data-theme='dark']) .comment-item__avatar--5 {
  background: #2e373a;
  color: #a9c0c9;
}

.comment-item__body {
  display: grid;
  min-width: 0;
  flex: 1 1 auto;
  gap: 0.2rem;
}

.comment-item__header {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.comment-item__author {
  color: var(--text-primary);
  font-size: 0.84rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.comment-item__badge {
  flex: none;
  padding: 0.08rem 0.4rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.3;
}

.comment-item__hidden-mark {
  flex: none;
  color: var(--text-muted);
  font-size: 0.68rem;
}

.comment-item__time {
  margin-left: auto;
  flex: none;
  color: var(--text-muted);
  font-size: 0.7rem;
  white-space: nowrap;
}

.comment-item__actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 0.1rem;
  opacity: 0;
  transition: opacity 140ms ease;
}

.comment-item__header:focus-within .comment-item__actions,
.comment-item:hover .comment-item__actions {
  opacity: 1;
}

@media (hover: none) {
  .comment-item__actions {
    opacity: 1;
  }
}

.comment-item__action {
  padding: 0.25rem 0.4rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  white-space: nowrap;
}

.comment-item__action:hover:not(:disabled) {
  color: var(--text-primary);
}

.comment-item__action--danger:hover:not(:disabled) {
  color: var(--danger);
}

.comment-item__action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
  border-radius: 0.35rem;
}

.comment-item__action:disabled {
  cursor: default;
  opacity: 0.6;
}

.comment-item__confirm {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid color-mix(in srgb, var(--danger) 32%, transparent);
  border-radius: 0.55rem;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 0.76rem;
}

.comment-item__content {
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.65;
  overflow-wrap: anywhere;
}

.comment-item__content :deep(p) {
  margin: 0 0 0.4rem;
}

.comment-item__content :deep(p:last-child) {
  margin-bottom: 0;
}

.comment-item__content :deep(a) {
  color: var(--accent-strong);
}

.comment-item__content :deep(code) {
  padding: 0.05rem 0.3rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-size: 0.82em;
}

.comment-item__content :deep(pre) {
  margin: 0.4rem 0;
  padding: 0.55rem 0.7rem;
  border-radius: 0.55rem;
  background: var(--surface-muted);
  overflow-x: auto;
}

.comment-item__content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.comment-item__content :deep(blockquote) {
  margin: 0.4rem 0;
  padding-left: 0.65rem;
  border-left: 2px solid var(--border-strong);
  color: var(--text-muted);
}

.comment-item__content :deep(ul),
.comment-item__content :deep(ol) {
  margin: 0.4rem 0;
  padding-left: 1.25rem;
}

.comment-item__replies {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.45rem;
  padding-left: 0.9rem;
  border-left: 1px solid var(--border-subtle);
}

.comment-item--hidden .comment-item__content,
.comment-item--hidden .comment-item__avatar,
.comment-item--hidden .comment-item__author {
  opacity: 0.62;
}

.comment-item--reply {
  gap: 0.5rem;
}

.comment-item--reply .comment-item__avatar {
  width: 28px;
  height: 28px;
  font-size: 0.76rem;
}

@media (max-width: 599px) {
  .comment-item__actions {
    flex-basis: 100%;
    margin-left: -0.4rem;
    opacity: 1;
  }

  .comment-item__action {
    min-height: 40px;
  }

  .comment-item__confirm {
    flex-wrap: wrap;
  }

  .comment-item__replies {
    padding-left: 1rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comment-item__actions {
    transition: none;
  }
}
</style>
