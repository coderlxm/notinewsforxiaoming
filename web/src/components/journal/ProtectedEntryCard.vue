<script setup lang="ts">
import { computed } from 'vue';
import type { ProtectedJournalEntryPreview } from '../../types';

const props = withDefaults(defineProps<{
  entry: ProtectedJournalEntryPreview;
  display?: 'waterfall' | 'article';
}>(), {
  display: 'waterfall',
});

const emit = defineEmits<{
  open: [entry: ProtectedJournalEntryPreview];
}>();

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const templateNumber = computed(() => {
  let hash = 0;
  for (const character of props.entry.publicId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return (hash % 7) + 1;
});
const typeLabel = computed(() => props.entry.entryType === 'article' ? '加密文章' : '加密记录');
const actionLabel = '输入密码查看';
const formattedDate = computed(() => dateFormatter.format(new Date(props.entry.sourceCreatedAt)));
</script>

<template>
  <article
    class="protected-card"
    :class="[
      `protected-card--${display}`,
      `protected-card--template-${templateNumber}`,
    ]"
  >
    <button
      class="protected-card__button"
      type="button"
      :aria-label="`${typeLabel}，${actionLabel}`"
      @click="emit('open', entry)"
    >
      <span class="protected-card__cover" aria-hidden="true">
        <span class="protected-card__ornament protected-card__ornament--one"></span>
        <span class="protected-card__ornament protected-card__ornament--two"></span>
        <span class="protected-card__eyebrow">PROTECTED</span>
        <svg class="protected-card__lock" viewBox="0 0 64 64" fill="none">
          <path d="M19 29v-7c0-8 5.4-14 13-14s13 6 13 14v7" />
          <rect x="12" y="28" width="40" height="29" rx="7" />
          <circle cx="32" cy="41" r="3.5" />
          <path d="M32 44.5v5" />
        </svg>
        <span class="protected-card__dots">••••••</span>
        <span class="protected-card__index">0{{ templateNumber }}</span>
      </span>
      <span class="protected-card__body">
        <strong class="protected-card__title">{{ typeLabel }}</strong>
        <span class="protected-card__action">{{ actionLabel }}</span>
        <time class="protected-card__date" :datetime="entry.sourceCreatedAt">{{ formattedDate }}</time>
      </span>
    </button>
  </article>
</template>

<style scoped>
.protected-card {
  --protected-bg: #eee9df;
  --protected-bg-secondary: #e1d9cc;
  --protected-ink: #2c302f;
  --protected-accent: #ad3840;
  overflow: hidden;
  border-radius: 1.25rem;
  background: var(--surface-card);
  transition: transform 180ms ease;
}

.protected-card:hover {
  transform: translateY(-2px);
}

.protected-card__button {
  display: grid;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.protected-card__cover {
  position: relative;
  display: grid;
  min-width: 0;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  background: var(--protected-bg);
  color: var(--protected-ink);
  isolation: isolate;
  place-items: center;
}

.protected-card--article .protected-card__cover {
  aspect-ratio: 16 / 10;
}

.protected-card__cover::before,
.protected-card__cover::after,
.protected-card__ornament {
  position: absolute;
  content: '';
  pointer-events: none;
}

.protected-card__eyebrow {
  position: absolute;
  top: 1.35rem;
  left: 1.35rem;
  z-index: 2;
  color: var(--protected-accent);
  font-family: var(--font-condensed);
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.protected-card__lock {
  z-index: 2;
  width: clamp(3.2rem, 24%, 5.4rem);
  color: var(--protected-ink);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3;
}

.protected-card__dots {
  position: absolute;
  bottom: 1.3rem;
  left: 1.35rem;
  z-index: 2;
  color: var(--protected-accent);
  font-size: 0.7rem;
  letter-spacing: 0.2em;
}

.protected-card__index {
  position: absolute;
  right: 1.2rem;
  bottom: 0.7rem;
  color: color-mix(in srgb, var(--protected-ink) 16%, transparent);
  font-family: var(--font-serif);
  font-size: clamp(4rem, 30%, 7rem);
  font-weight: 800;
  line-height: 1;
}

.protected-card__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2rem 0.8rem;
  padding: 0.85rem 0.9rem 0.72rem;
}

.protected-card__title {
  min-width: 0;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 0.98rem;
}

.protected-card__action {
  justify-self: end;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.protected-card__date {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.68rem;
}

.protected-card--template-1 .protected-card__cover {
  background:
    linear-gradient(90deg, transparent 14%, var(--protected-accent) 14% 15%, transparent 15%),
    repeating-linear-gradient(0deg, transparent 0 2.4rem, color-mix(in srgb, var(--protected-ink) 11%, transparent) 2.4rem calc(2.4rem + 1px)),
    var(--protected-bg);
}

.protected-card--template-1 .protected-card__lock {
  transform: rotate(-3deg);
}

.protected-card--template-2 {
  --protected-bg: #efe4d0;
  --protected-bg-secondary: #d8c3a5;
  --protected-accent: #8f593f;
}

.protected-card--template-2 .protected-card__cover::before {
  inset: 0 49% 0 auto;
  width: 10%;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--protected-ink) 15%, transparent), transparent);
}

.protected-card--template-2 .protected-card__lock {
  padding: 0.8rem;
  border: 1px solid color-mix(in srgb, var(--protected-ink) 25%, transparent);
  border-radius: 50%;
}

.protected-card--template-3 {
  --protected-bg: #e7e4d9;
  --protected-bg-secondary: #d64b45;
  --protected-accent: #d64b45;
}

.protected-card--template-3 .protected-card__cover::before {
  inset: 0 auto 0 0;
  width: 21%;
  background: var(--protected-accent);
}

.protected-card--template-3 .protected-card__cover::after {
  top: 22%;
  right: 0;
  width: 79%;
  height: 2px;
  background: var(--protected-ink);
}

.protected-card--template-3 .protected-card__eyebrow,
.protected-card--template-3 .protected-card__dots {
  left: 26%;
}

.protected-card--template-4 {
  --protected-bg: #e8dfcd;
  --protected-bg-secondary: #d5c6a8;
  --protected-accent: #9c3c38;
}

.protected-card--template-4 .protected-card__cover::before {
  inset: 1.1rem;
  border: 1px solid color-mix(in srgb, var(--protected-ink) 22%, transparent);
  border-radius: 0.2rem;
}

.protected-card--template-4 .protected-card__cover::after {
  top: 24%;
  left: -8%;
  width: 58%;
  aspect-ratio: 1;
  border: 1px solid color-mix(in srgb, var(--protected-accent) 38%, transparent);
  border-radius: 50%;
  transform: rotate(-18deg);
}

.protected-card--template-5 {
  --protected-bg: #202027;
  --protected-bg-secondary: #322c38;
  --protected-ink: #ececec;
  --protected-accent: #df6670;
}

.protected-card--template-5 .protected-card__cover {
  background:
    radial-gradient(circle at 75% 75%, color-mix(in srgb, var(--protected-accent) 24%, transparent), transparent 42%),
    linear-gradient(150deg, var(--protected-bg), var(--protected-bg-secondary));
}

.protected-card--template-5 .protected-card__cover::before {
  inset: auto -18% -30% 30%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, var(--protected-accent) 10%, transparent);
}

.protected-card--template-6 {
  --protected-bg: #eee8d5;
  --protected-bg-secondary: #d7d1bb;
  --protected-accent: #a33c43;
}

.protected-card--template-6 .protected-card__cover {
  background:
    linear-gradient(90deg, transparent 12%, color-mix(in srgb, var(--protected-accent) 45%, transparent) 12% calc(12% + 2px), transparent calc(12% + 2px)),
    repeating-linear-gradient(0deg, transparent 0 2rem, color-mix(in srgb, #66859a 30%, transparent) 2rem calc(2rem + 1px)),
    var(--protected-bg);
}

.protected-card--template-6 .protected-card__lock {
  transform: rotate(2deg);
}

.protected-card--template-7 {
  --protected-bg: #ece9e1;
  --protected-bg-secondary: #d9d3c8;
  --protected-accent: #9e353c;
}

.protected-card--template-7 .protected-card__cover::before {
  inset: 22% 0 auto;
  height: 1px;
  background: var(--protected-ink);
  box-shadow: 0 0.55rem 0 color-mix(in srgb, var(--protected-ink) 24%, transparent);
}

.protected-card--template-7 .protected-card__cover::after {
  top: 0;
  bottom: 0;
  left: 32%;
  width: 1px;
  background: color-mix(in srgb, var(--protected-ink) 17%, transparent);
}

@media (prefers-color-scheme: dark) {
  .protected-card {
    --protected-bg: #242522;
    --protected-bg-secondary: #30312d;
    --protected-ink: #ececec;
    --protected-accent: #dc6870;
  }

  .protected-card--template-2 {
    --protected-bg: #29251f;
    --protected-bg-secondary: #393126;
    --protected-accent: #d27b58;
  }

  .protected-card--template-3 {
    --protected-bg: #232623;
    --protected-bg-secondary: #a73b3e;
    --protected-accent: #c84b50;
  }

  .protected-card--template-4 {
    --protected-bg: #2a2721;
    --protected-bg-secondary: #3a3327;
    --protected-accent: #cf6464;
  }

  .protected-card--template-5 {
    --protected-bg: #1d1e24;
    --protected-bg-secondary: #312a37;
  }

  .protected-card--template-6 {
    --protected-bg: #272721;
    --protected-bg-secondary: #35342b;
    --protected-accent: #d6656c;
  }

  .protected-card--template-7 {
    --protected-bg: #242523;
    --protected-bg-secondary: #33332e;
    --protected-accent: #d6646b;
  }
}

@media (max-width: 599px) {
  .protected-card__eyebrow {
    top: 1rem;
    left: 1rem;
  }

  .protected-card__dots {
    bottom: 1rem;
    left: 1rem;
  }

  .protected-card--template-3 .protected-card__eyebrow,
  .protected-card--template-3 .protected-card__dots {
    left: 26%;
  }
}
</style>
