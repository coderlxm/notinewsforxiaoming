<script setup lang="ts">
import { computed, shallowRef } from 'vue';

const props = withDefaults(defineProps<{
  mode: 'visitor' | 'owner';
  busy: boolean;
  replyToName?: string;
  initialAuthorName?: string;
  context?: 'comment' | 'guestbook';
  disabled?: boolean;
}>(), {
  replyToName: undefined,
  initialAuthorName: undefined,
  context: 'comment',
  disabled: false,
});

const emit = defineEmits<{
  submit: [input: { authorName: string; content: string; website: string }];
}>();

const isGuestbook = computed(() => props.context === 'guestbook');
const nameInputId = computed(() => (isGuestbook.value ? 'guestbook-author-name' : 'comment-author-name'));

const authorName = shallowRef(props.initialAuthorName ?? '');
const content = shallowRef('');
const website = shallowRef('');
const focused = shallowRef(false);
const failed = shallowRef(false);
const markdownHintOpen = shallowRef(false);

const expanded = computed(() => props.mode === 'owner'
  || focused.value
  || content.value.trim() !== ''
  || failed.value);

const canSubmit = computed(() => content.value.trim() !== ''
  && (props.mode === 'owner' || authorName.value.trim() !== '')
  && !props.busy
  && !props.disabled);

function submit(): void {
  if (!canSubmit.value) return;
  emit('submit', {
    authorName: authorName.value.trim(),
    content: content.value,
    website: website.value,
  });
}

function handleKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
    event.preventDefault();
    submit();
  }
}

function handleFocusOut(event: FocusEvent): void {
  const form = event.currentTarget as HTMLFormElement;
  if (event.relatedTarget instanceof Node && form.contains(event.relatedTarget)) return;
  focused.value = false;
}

function handleInput(): void {
  failed.value = false;
}

function markFailed(): void {
  failed.value = true;
}

function clearContent(): void {
  content.value = '';
  failed.value = false;
}

defineExpose({ clearContent, markFailed });
</script>

<template>
  <form
    class="comment-form"
    :class="{
      'comment-form--expanded': expanded,
      'comment-form--guestbook': isGuestbook,
    }"
    @focusin="focused = true"
    @focusout="handleFocusOut"
    @submit.prevent="submit"
  >
    <p v-if="mode === 'owner' && replyToName" class="comment-form__reply-context">
      回复 {{ replyToName }}
    </p>
    <textarea
      v-model="content"
      class="comment-form__content"
      :aria-label="mode === 'owner' ? '回复内容' : isGuestbook ? '留言内容' : '评论内容'"
      :name="mode === 'owner' ? 'reply-content' : isGuestbook ? 'guestbook-content' : 'comment-content'"
      :rows="mode === 'owner' ? 3 : isGuestbook ? 3 : 2"
      :placeholder="mode === 'owner' ? '写下你的回复……' : isGuestbook ? '留下你的想法与留言……' : '留下你的想法……'"
      maxlength="1000"
      :disabled="busy || disabled"
      @input="handleInput"
      @keydown="handleKeydown"
    />
    <input
      v-model="website"
      class="comment-form__honeypot"
      type="text"
      name="website"
      tabindex="-1"
      autocomplete="off"
      aria-hidden="true"
    >
    <div v-if="expanded" class="comment-form__auxiliary">
      <template v-if="mode === 'visitor'">
        <label class="comment-form__name-label" :for="nameInputId">昵称</label>
        <input
          :id="nameInputId"
          v-model="authorName"
          class="comment-form__name"
          type="text"
          :name="nameInputId"
          maxlength="24"
          placeholder="怎么称呼你？"
          :disabled="busy || disabled"
          autocomplete="name"
        >
      </template>
      <button
        v-if="mode === 'visitor'"
        type="button"
        class="comment-form__hint-toggle"
        :aria-expanded="markdownHintOpen"
        @click="markdownHintOpen = !markdownHintOpen"
      >
        支持 Markdown
      </button>
      <button
        class="comment-form__submit"
        type="submit"
        :disabled="!canSubmit"
        :aria-busy="busy"
      >
        {{ mode === 'owner' ? '发送回复' : isGuestbook ? '发送留言' : '发送评论' }}
      </button>
    </div>
    <ul v-if="expanded && markdownHintOpen" class="comment-form__hint">
      <li><code>**粗体**</code>、<code>*斜体*</code>、<code>~~删除线~~</code></li>
      <li><code>`行内代码`</code> 与代码块</li>
      <li><code>[文字](链接)</code> 引用链接</li>
    </ul>
  </form>
</template>

<style scoped>
.comment-form {
  position: relative;
  display: grid;
  gap: 0.55rem;
  padding: 0.8rem 0.95rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.comment-form--guestbook {
  padding: clamp(0.9rem, 2.5vw, 1.15rem) clamp(1rem, 3vw, 1.35rem) 0.85rem;
}

.comment-form:focus-within {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 18%, transparent);
}

.comment-form__reply-context {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
}

.comment-form__content {
  width: 100%;
  min-height: 2.8rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 0.92rem;
  line-height: 1.7;
  resize: vertical;
}

.comment-form--guestbook .comment-form__content {
  min-height: 3.2rem;
}

.comment-form__content:focus {
  outline: none;
}

.comment-form__content::placeholder {
  color: var(--text-muted);
  opacity: 0.75;
}

.comment-form__honeypot {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.comment-form__auxiliary {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--border-subtle);
  animation: comment-form-reveal 180ms var(--ease-card);
}

.comment-form__name-label {
  flex: none;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 550;
}

.comment-form__name {
  width: 10.5rem;
  min-height: 2.2rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font: inherit;
  font-size: 0.86rem;
}

.comment-form__name:focus {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.comment-form__hint-toggle {
  margin-left: auto;
  padding: 0.3rem 0.4rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.74rem;
  white-space: nowrap;
  border-radius: 4px;
}

.comment-form__hint-toggle:hover {
  color: var(--text-primary);
}

.comment-form__hint-toggle:focus-visible,
.comment-form__submit:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.comment-form__submit {
  flex: none;
  min-height: 2.25rem;
  padding: 0.28rem 1rem;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}

.comment-form__submit:not(:disabled):hover {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.comment-form__submit:disabled {
  opacity: 0.5;
  cursor: default;
}

.comment-form__hint {
  margin: 0;
  padding: 0.4rem 0.2rem 0.1rem;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.7;
}

.comment-form__hint code {
  padding: 0.05rem 0.3rem;
  border-radius: 0.35rem;
  background: var(--surface-muted);
}

@keyframes comment-form-reveal {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 599px) {
  .comment-form__auxiliary {
    flex-wrap: wrap;
  }

  .comment-form__name {
    width: 100%;
  }

  .comment-form__hint-toggle {
    order: 1;
    margin-left: 0;
    min-height: 36px;
  }

  .comment-form__submit {
    order: 2;
    margin-left: auto;
    min-height: 36px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .comment-form__auxiliary {
    animation: none;
  }
}
</style>
