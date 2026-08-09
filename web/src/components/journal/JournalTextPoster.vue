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

const posterText = computed(() => stripJournalTags(props.entry.contentText, props.entry.tags));
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
  : (props.entry.visibility === 'public' ? 'PUBLIC NOTE' : 'PRIVATE NOTE'));
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
  --poster-background: #edeae1;
  --poster-color: #293638;
  --poster-muted: #6f706b;
  --poster-accent: #b4313d;
  --poster-mark: rgb(41 54 56 / 5%);
  --poster-border: transparent;
  --poster-font: var(--font-serif);
  --poster-align: left;
  --poster-radius: 0;
  --poster-shadow: 0 22px 54px rgb(0 0 0 / 22%);
  --poster-letter-spacing: -0.035em;
  --poster-frame: rgb(41 54 56 / 9%);
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
  border: 1px solid var(--poster-border);
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
  border: 1px solid var(--poster-frame);
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
  line-height: 1.38;
  -webkit-line-clamp: 6;
}

.text-poster__text--medium {
  font-size: clamp(1.75rem, 3.3vw, 3.6rem);
  line-height: 1.48;
  -webkit-line-clamp: 8;
}

.text-poster__text--long {
  font-size: clamp(1.3rem, 2.35vw, 2.55rem);
  line-height: 1.6;
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
}

.text-poster--card .text-poster__sheet {
  height: auto;
  padding: clamp(1.15rem, 7cqw, 2rem);
  box-shadow: none;
}

.text-poster--card .text-poster__sheet::before {
  font-size: clamp(15rem, 90cqw, 28rem);
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
  font-size: clamp(1.3rem, 6.5cqw, 2.1rem);
  -webkit-line-clamp: 7;
}

.text-poster--card .text-poster__text--long {
  font-size: clamp(1.15rem, 5.8cqw, 1.8rem);
  -webkit-line-clamp: 5;
}

.text-poster--editorial {
  --poster-background:
    linear-gradient(145deg, rgb(255 255 255 / 58%), transparent 42%),
    radial-gradient(circle at 85% 13%, rgb(196 59 70 / 12%), transparent 24%),
    radial-gradient(circle at 12% 88%, rgb(61 85 88 / 12%), transparent 26%),
    #edeae1;
}

.text-poster--book {
  --poster-background:
    linear-gradient(90deg, rgb(91 63 40 / 11%), transparent 8%, transparent 92%, rgb(91 63 40 / 7%)),
    #f2ead8;
  --poster-color: #3c3027;
  --poster-muted: #786b5d;
  --poster-accent: #9b5a36;
  --poster-mark: rgb(116 76 46 / 6%);
  --poster-border: rgb(94 65 43 / 16%);
  --poster-frame: rgb(94 65 43 / 16%);
  --poster-letter-spacing: 0.01em;
}

.text-poster--book .text-poster__sheet::before {
  right: auto;
  bottom: -0.1em;
  left: -0.14em;
  content: '§';
}

.text-poster--book .text-poster__rule {
  width: 1px;
  height: 30px;
}

.text-poster--swiss {
  --poster-background:
    linear-gradient(90deg, #d52f3c 0 8%, transparent 8%),
    linear-gradient(180deg, transparent 0 72%, rgb(20 24 24 / 7%) 72%),
    #f1f2ef;
  --poster-color: #151918;
  --poster-muted: #4d5553;
  --poster-accent: #d52f3c;
  --poster-mark: rgb(213 47 60 / 9%);
  --poster-frame: transparent;
  --poster-font: var(--font-condensed);
  --poster-letter-spacing: -0.015em;
}

.text-poster--swiss .text-poster__sheet {
  padding-left: 14%;
}

.text-poster--swiss .text-poster__sheet::before {
  top: -0.15em;
  right: -0.04em;
  bottom: auto;
  content: '07';
  font-family: var(--font-condensed);
  font-size: clamp(10rem, 56cqw, 24rem);
}

.text-poster--swiss .text-poster__rule {
  flex: 1;
}

.text-poster--archive {
  --poster-background:
    repeating-linear-gradient(0deg, transparent 0 31px, rgb(90 67 41 / 8%) 31px 32px),
    #e8dcc0;
  --poster-color: #3f362b;
  --poster-muted: #726553;
  --poster-accent: #a84432;
  --poster-mark: rgb(132 83 49 / 7%);
  --poster-border: rgb(88 68 42 / 30%);
  --poster-frame: rgb(88 68 42 / 24%);
  --poster-font: var(--font-condensed);
  --poster-letter-spacing: 0.025em;
}

.text-poster--archive .text-poster__sheet::after {
  border-style: dashed;
}

.text-poster--archive .text-poster__sheet::before {
  right: 0.02em;
  bottom: -0.08em;
  content: 'A';
}

.text-poster--cinema {
  --poster-background:
    radial-gradient(circle at 70% 24%, rgb(153 60 108 / 26%), transparent 30%),
    linear-gradient(160deg, #e8e9ed, #cfd4dc 58%, #e8e3e6);
  --poster-color: #17212e;
  --poster-muted: #59616d;
  --poster-accent: #973a69;
  --poster-mark: rgb(95 51 94 / 8%);
  --poster-frame: rgb(39 49 67 / 12%);
  --poster-align: center;
  --poster-letter-spacing: 0.015em;
}

.text-poster--cinema .text-poster__header,
.text-poster--cinema .text-poster__footer {
  justify-content: center;
}

.text-poster--cinema .text-poster__footer span:first-child {
  display: none;
}

.text-poster--cinema .text-poster__sheet::before {
  right: 50%;
  bottom: -0.36em;
  content: '●';
  transform: translateX(50%);
}

.text-poster--notebook {
  --poster-background:
    linear-gradient(90deg, transparent 0 12%, rgb(198 72 72 / 22%) 12% 12.5%, transparent 12.5%),
    repeating-linear-gradient(0deg, #f2edcf 0 29px, #cbd3c5 29px 30px);
  --poster-color: #34403c;
  --poster-muted: #68746e;
  --poster-accent: #c14d4f;
  --poster-mark: rgb(48 84 75 / 5%);
  --poster-frame: transparent;
  --poster-letter-spacing: 0.01em;
}

.text-poster--notebook .text-poster__sheet {
  padding-left: 17%;
}

.text-poster--notebook .text-poster__sheet::after {
  top: -2%;
  right: 12%;
  bottom: auto;
  left: auto;
  width: 24%;
  height: 7%;
  border: 0;
  background: rgb(209 166 110 / 48%);
  transform: rotate(3deg);
}

.text-poster--notebook .text-poster__sheet::before {
  content: '✎';
}

.text-poster--gazette {
  --poster-background:
    repeating-linear-gradient(90deg, transparent 0 49.8%, rgb(41 36 32 / 5%) 49.8% 50.2%, transparent 50.2% 100%),
    #efede6;
  --poster-color: #211f1c;
  --poster-muted: #625f58;
  --poster-accent: #8e2932;
  --poster-mark: rgb(33 31 28 / 5%);
  --poster-border: rgb(33 31 28 / 16%);
  --poster-frame: rgb(33 31 28 / 18%);
  --poster-font: var(--font-serif);
  --poster-align: center;
  --poster-letter-spacing: -0.045em;
}

.text-poster--gazette .text-poster__header {
  padding-bottom: 0.55rem;
  border-bottom: 3px double var(--poster-color);
  justify-content: space-between;
}

.text-poster--gazette .text-poster__rule {
  width: 30%;
  height: 1px;
}

.text-poster--gazette .text-poster__footer {
  padding-top: 0.55rem;
  border-top: 1px solid var(--poster-color);
}

.text-poster--gazette .text-poster__sheet::before {
  top: 0.12em;
  right: 0.02em;
  bottom: auto;
  content: 'N°';
  font-family: var(--font-condensed);
  font-size: clamp(8rem, 42cqw, 19rem);
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

@media (prefers-color-scheme: dark) {
  .text-poster {
    background: #171715;
  }

  .text-poster--editorial {
    --poster-background:
      linear-gradient(145deg, rgb(255 255 255 / 4%), transparent 42%),
      radial-gradient(circle at 85% 13%, rgb(228 91 102 / 13%), transparent 24%),
      radial-gradient(circle at 12% 88%, rgb(111 143 142 / 12%), transparent 26%),
      #1d201e;
    --poster-color: #ebe8df;
    --poster-muted: #999a94;
    --poster-accent: #d65c67;
    --poster-mark: rgb(235 232 223 / 5%);
    --poster-frame: rgb(235 232 223 / 8%);
  }

  .text-poster--book {
    --poster-background:
      linear-gradient(90deg, rgb(0 0 0 / 24%), transparent 8%, transparent 92%, rgb(0 0 0 / 16%)),
      #211b17;
    --poster-color: #eee1ca;
    --poster-muted: #aa9a84;
    --poster-accent: #c78758;
    --poster-mark: rgb(214 175 126 / 6%);
    --poster-border: rgb(210 171 121 / 16%);
    --poster-frame: rgb(210 171 121 / 13%);
  }

  .text-poster--swiss {
    --poster-background:
      linear-gradient(90deg, #9f2d38 0 8%, transparent 8%),
      linear-gradient(180deg, transparent 0 72%, rgb(255 255 255 / 4%) 72%),
      #202422;
    --poster-color: #f0f1ed;
    --poster-muted: #a2aaa6;
    --poster-accent: #e45a65;
    --poster-mark: rgb(228 90 101 / 10%);
  }

  .text-poster--archive {
    --poster-background:
      repeating-linear-gradient(0deg, transparent 0 31px, rgb(205 174 122 / 7%) 31px 32px),
      #25251d;
    --poster-color: #e7d8b9;
    --poster-muted: #a89b7e;
    --poster-accent: #c86b4e;
    --poster-mark: rgb(207 149 90 / 7%);
    --poster-border: rgb(209 178 121 / 20%);
    --poster-frame: rgb(209 178 121 / 16%);
  }

  .text-poster--cinema {
    --poster-background:
      radial-gradient(circle at 70% 24%, rgb(171 61 117 / 24%), transparent 30%),
      linear-gradient(160deg, #11151d, #1d2029 58%, #171319);
    --poster-color: #ececf2;
    --poster-muted: #9da1ad;
    --poster-accent: #d270a3;
    --poster-mark: rgb(210 112 163 / 8%);
    --poster-frame: rgb(230 230 242 / 10%);
  }

  .text-poster--notebook {
    --poster-background:
      linear-gradient(90deg, transparent 0 12%, rgb(183 68 73 / 25%) 12% 12.5%, transparent 12.5%),
      repeating-linear-gradient(0deg, #202827 0 29px, #34403d 29px 30px);
    --poster-color: #e5e1ce;
    --poster-muted: #a5aa9e;
    --poster-accent: #d36769;
    --poster-mark: rgb(203 214 189 / 5%);
  }

  .text-poster--notebook .text-poster__sheet::after {
    background: rgb(157 112 65 / 50%);
  }

  .text-poster--gazette {
    --poster-background:
      repeating-linear-gradient(90deg, transparent 0 49.8%, rgb(238 235 226 / 4%) 49.8% 50.2%, transparent 50.2% 100%),
      #1d1c1a;
    --poster-color: #ebe8df;
    --poster-muted: #aaa69d;
    --poster-accent: #ce5a63;
    --poster-mark: rgb(235 232 223 / 5%);
    --poster-border: rgb(235 232 223 / 13%);
    --poster-frame: rgb(235 232 223 / 12%);
  }
}
</style>
