<script setup lang="ts">
import { computed } from 'vue';
import type { JournalEntry } from '../../types';
import { stripJournalTags } from '../../utils/journalText';
import { resolveTextPosterTemplate } from '../../utils/textPosterTemplate';

const props = withDefaults(defineProps<{
  entry: JournalEntry;
  display?: 'card' | 'detail';
}>(), {
  display: 'detail',
});

const posterText = computed(() =>
  props.entry.title?.trim() || stripJournalTags(props.entry.contentText, props.entry.tags));
const textLength = computed(() => Array.from(posterText.value).length);
const textSizeClass = computed(() => {
  if (textLength.value <= 30) return 'text-poster__text--short';
  if (textLength.value <= 70) return 'text-poster__text--medium';
  return 'text-poster__text--long';
});
const template = computed(() => resolveTextPosterTemplate(props.entry.publicId));
const posterClass = computed(() => [
  `text-poster--${props.display}`,
  `text-poster--${template.value}`,
]);
const decorativeMark = computed(() => /[?？]/.test(posterText.value) ? '?' : '“');
const visibilityLabel = computed(() => props.entry.publicationStatus === 'draft'
  ? 'DRAFT NOTE'
  : (props.entry.visibility === 'public'
      ? 'PUBLIC NOTE'
      : (props.entry.visibility === 'protected' ? 'PROTECTED NOTE' : 'PRIVATE NOTE')));
</script>

<template>
  <section class="text-poster" :class="posterClass" aria-hidden="true">
    <div class="text-poster__sheet" :data-mark="decorativeMark">
      <header class="text-poster__header">
        <span class="text-poster__eyebrow">{{ visibilityLabel }}</span>
        <span class="text-poster__rule" />
      </header>

      <p class="text-poster__text" :class="textSizeClass">{{ posterText }}</p>

      <footer class="text-poster__footer">
        <span>小明同学</span>
        <span>NOTE</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.text-poster {
  --poster-background: var(--poster-background-light);
  --poster-color: var(--poster-color-light);
  --poster-muted: var(--poster-muted-light);
  --poster-accent: var(--poster-accent-light);
  --poster-mark: var(--poster-mark-light);
  --poster-font: var(--font-serif);
  --poster-align: left;
  --poster-radius: 0;
  --poster-shadow: 0 22px 54px rgb(0 0 0 / 22%);
  --poster-letter-spacing: -0.035em;
  display: grid;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #20201e;
  container-type: inline-size;
  place-items: center;
}

.text-poster__sheet {
  position: relative;
  display: grid;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  aspect-ratio: 4 / 5;
  grid-template-rows: auto minmax(0, 1fr) auto;
  padding: clamp(28px, 4vw, 56px);
  overflow: hidden;
  border-radius: var(--poster-radius);
  background: var(--poster-background);
  box-shadow: var(--poster-shadow);
  color: var(--poster-color);
  isolation: isolate;
}

.text-poster__sheet::before {
  position: absolute;
  z-index: -1;
  right: -0.08em;
  bottom: -0.32em;
  color: var(--poster-mark);
  content: attr(data-mark);
  font-family: var(--font-serif);
  font-size: clamp(22rem, 42vw, 40rem);
  font-weight: 700;
  line-height: 1;
}

.text-poster__sheet::after {
  position: absolute;
  z-index: -1;
  content: '';
  inset: 4.5%;
  pointer-events: none;
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
  color: var(--poster-accent);
  font-family: var(--font-condensed);
  font-size: clamp(0.62rem, 1vw, 0.78rem);
  font-weight: 800;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

.text-poster__rule {
  width: 40px;
  height: 2px;
  background: var(--poster-accent);
}

.text-poster__text {
  display: -webkit-box;
  align-self: center;
  margin: 0;
  overflow: hidden;
  color: var(--poster-color);
  font-family: var(--poster-font);
  font-weight: 700;
  letter-spacing: var(--poster-letter-spacing);
  overflow-wrap: anywhere;
  text-align: var(--poster-align);
  white-space: pre-wrap;
  -webkit-box-orient: vertical;
}

.text-poster__text--short {
  font-size: clamp(2.25rem, 4.4vw, 4.8rem);
  line-height: 1.46;
  -webkit-line-clamp: 6;
}

.text-poster__text--medium {
  font-size: clamp(1.75rem, 3.3vw, 3.6rem);
  line-height: 1.56;
  -webkit-line-clamp: 8;
}

.text-poster__text--long {
  font-size: clamp(1.3rem, 2.35vw, 2.55rem);
  line-height: 1.68;
  -webkit-line-clamp: 10;
}

.text-poster__footer {
  justify-content: space-between;
  gap: 16px;
  color: var(--poster-muted);
  font-family: var(--font-condensed);
  font-size: clamp(0.64rem, 1vw, 0.78rem);
  letter-spacing: 0.05em;
}

.text-poster--card {
  width: 100%;
  border-radius: 0;
  background: var(--poster-background);
}

.text-poster--card .text-poster__sheet {
  height: auto;
  aspect-ratio: auto;
  grid-template-rows: auto auto auto;
  row-gap: clamp(1rem, 6cqw, 2rem);
  padding: clamp(1.15rem, 7cqw, 2rem);
  box-shadow: none;
}

.text-poster--card .text-poster__sheet::before {
  font-size: clamp(15rem, 90cqw, 28rem);
}

.text-poster--card .text-poster__text {
  width: fit-content;
  max-width: 100%;
  justify-self: center;
}

.text-poster--card .text-poster__eyebrow,
.text-poster--card .text-poster__footer {
  font-size: clamp(0.58rem, 2.8cqw, 0.72rem);
}

.text-poster--card .text-poster__text--short {
  font-size: clamp(1.65rem, 8.5cqw, 2.8rem);
  -webkit-line-clamp: 5;
}

.text-poster--card .text-poster__text--medium {
  font-size: clamp(1.4rem, 7cqw, 2.2rem);
  -webkit-line-clamp: 5;
}

.text-poster--card .text-poster__text--long {
  font-size: clamp(1.15rem, 5.8cqw, 1.8rem);
  -webkit-line-clamp: 5;
}

@media (max-width: 959px) {
  .text-poster--detail {
    width: 100%;
    padding: 0;
    flex: 0 0 auto;
  }

  .text-poster--detail .text-poster__sheet {
    width: 100%;
    height: auto;
    padding:
      max(clamp(26px, 8vw, 46px), calc(env(safe-area-inset-top) + 16px))
      max(clamp(26px, 8vw, 46px), calc(env(safe-area-inset-right) + 16px))
      max(clamp(26px, 8vw, 46px), calc(env(safe-area-inset-bottom) + 16px))
      max(clamp(26px, 8vw, 46px), calc(env(safe-area-inset-left) + 16px));
  }

  .text-poster--detail .text-poster__text--short {
    font-size: clamp(2rem, 10vw, 3.8rem);
  }

  .text-poster--detail .text-poster__text--medium {
    font-size: clamp(1.55rem, 7.5vw, 2.8rem);
  }

  .text-poster--detail .text-poster__text--long {
    font-size: clamp(1.15rem, 5.4vw, 1.9rem);
  }
}

:global(html[data-theme='dark'] .text-poster) {
  --poster-background: var(--poster-background-dark);
  --poster-color: var(--poster-color-dark);
  --poster-muted: var(--poster-muted-dark);
  --poster-accent: var(--poster-accent-dark);
  --poster-mark: var(--poster-mark-dark);
  background: #171715;
}
</style>

<style scoped src="./text-poster-templates.css"></style>
