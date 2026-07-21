<script setup lang="ts">
import { computed } from 'vue';
import type { JournalEntry } from '../../types';

const props = defineProps<{
  entry: JournalEntry;
}>();

const posterText = computed(() => props.entry.contentText.trim());
const textLength = computed(() => Array.from(posterText.value).length);
const textSizeClass = computed(() => {
  if (textLength.value <= 30) return 'text-poster__text--short';
  if (textLength.value <= 70) return 'text-poster__text--medium';
  return 'text-poster__text--long';
});
const decorativeMark = computed(() => /[?？]/.test(posterText.value) ? '?' : '“');
const visibilityLabel = computed(() => props.entry.visibility === 'public' ? 'PUBLIC NOTE' : 'PRIVATE NOTE');
const posterDate = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(props.entry.sourceCreatedAt)));
</script>

<template>
  <section class="text-poster" aria-hidden="true">
    <div class="text-poster__sheet" :data-mark="decorativeMark">
      <header class="text-poster__header">
        <span class="text-poster__eyebrow">{{ visibilityLabel }}</span>
        <span class="text-poster__rule" />
      </header>

      <p class="text-poster__text" :class="textSizeClass">{{ posterText }}</p>

      <footer class="text-poster__footer">
        <span>小明同学</span>
        <time :datetime="entry.sourceCreatedAt">{{ posterDate }}</time>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.text-poster {
  display: grid;
  min-width: 0;
  min-height: 0;
  padding: 32px;
  overflow: hidden;
  background: #20201e;
  place-items: center;
}

.text-poster__sheet {
  position: relative;
  display: grid;
  width: min(76%, 62dvh, 620px);
  aspect-ratio: 4 / 5;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: clamp(28px, 4vw, 56px);
  overflow: hidden;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 58%), transparent 42%),
    radial-gradient(circle at 85% 13%, rgb(196 59 70 / 12%), transparent 24%),
    radial-gradient(circle at 12% 88%, rgb(61 85 88 / 12%), transparent 26%),
    #edeae1;
  box-shadow: 0 22px 54px rgb(0 0 0 / 22%);
  color: #293638;
  isolation: isolate;
}

.text-poster__sheet::before {
  position: absolute;
  z-index: -1;
  right: -0.08em;
  bottom: -0.32em;
  color: rgb(41 54 56 / 5%);
  content: attr(data-mark);
  font-family: var(--font-serif);
  font-size: clamp(22rem, 42vw, 40rem);
  font-weight: 700;
  line-height: 1;
}

.text-poster__header,
.text-poster__footer {
  display: flex;
  align-items: center;
}

.text-poster__header {
  gap: 14px;
}

.text-poster__eyebrow {
  color: #a92d38;
  font-family: var(--font-condensed);
  font-size: clamp(0.62rem, 1vw, 0.78rem);
  font-weight: 800;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.text-poster__rule {
  width: 40px;
  height: 2px;
  background: #c43b46;
}

.text-poster__text {
  display: -webkit-box;
  align-self: center;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-serif);
  font-weight: 700;
  letter-spacing: -0.035em;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
}

.text-poster__text--short {
  font-size: clamp(2.25rem, 4.4vw, 4.8rem);
  line-height: 1.3;
  -webkit-line-clamp: 6;
}

.text-poster__text--medium {
  font-size: clamp(1.75rem, 3.3vw, 3.6rem);
  line-height: 1.4;
  -webkit-line-clamp: 8;
}

.text-poster__text--long {
  font-size: clamp(1.3rem, 2.35vw, 2.55rem);
  line-height: 1.52;
  -webkit-line-clamp: 10;
}

.text-poster__footer {
  justify-content: space-between;
  gap: 16px;
  color: #6f706b;
  font-family: var(--font-condensed);
  font-size: clamp(0.64rem, 1vw, 0.78rem);
  letter-spacing: 0.05em;
}

@media (max-width: 959px) {
  .text-poster {
    width: 100%;
    padding:
      max(64px, calc(env(safe-area-inset-top) + 54px))
      max(16px, env(safe-area-inset-right))
      24px
      max(16px, env(safe-area-inset-left));
    flex: 0 0 auto;
  }

  .text-poster__sheet {
    width: min(100%, 30rem);
    padding: clamp(26px, 8vw, 46px);
  }

  .text-poster__text--short {
    font-size: clamp(2rem, 10vw, 3.8rem);
  }

  .text-poster__text--medium {
    font-size: clamp(1.55rem, 7.5vw, 2.8rem);
  }

  .text-poster__text--long {
    font-size: clamp(1.15rem, 5.4vw, 1.9rem);
  }
}

@media (prefers-color-scheme: dark) {
  .text-poster {
    background: #171715;
  }
}
</style>
