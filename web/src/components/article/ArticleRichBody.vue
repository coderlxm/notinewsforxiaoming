<script setup lang="ts">
import { useEventListener, useMediaQuery } from '@vueuse/core';
import {
  computed,
  nextTick,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { JournalRichDocument } from '../../types';
import { extractArticleHeadings } from '../../utils/articleHeadings';
import ArticleTableOfContents from './ArticleTableOfContents.vue';
import RichArticleRenderer from './RichArticleRenderer.vue';

const props = defineProps<{
  document: JournalRichDocument | null;
}>();

const route = useRoute();
const router = useRouter();
const root = useTemplateRef<HTMLElement>('root');
const scrollContainer = shallowRef<HTMLElement | null>(null);
const activeId = shallowRef('');
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
const headings = computed(() => extractArticleHeadings(props.document));
let selectingAnchor = false;

function headingElements(): HTMLElement[] {
  return root.value
    ? Array.from(root.value.querySelectorAll<HTMLElement>('[data-anchorid]'))
    : [];
}

function findScrollContainer(element: HTMLElement): HTMLElement {
  let parent = element.parentElement;
  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  throw new Error('Article rich body requires a scroll container.');
}

function hashAnchorId(): string {
  return route.hash.startsWith('#') ? route.hash.slice(1) : '';
}

function targetFor(id: string): HTMLElement | null {
  return headingElements().find(element => element.getAttribute('data-anchorid') === id) ?? null;
}

function updateActiveId(): void {
  const elements = headingElements();
  if (!elements.length || !scrollContainer.value) {
    activeId.value = '';
    return;
  }
  const threshold = scrollContainer.value.getBoundingClientRect().top + 32;
  const passed = elements.filter(element => element.getBoundingClientRect().top <= threshold);
  activeId.value = (passed.at(-1) ?? elements[0]).getAttribute('data-anchorid') ?? '';
}

function scrollToAnchor(id: string, behavior: ScrollBehavior): boolean {
  const target = targetFor(id);
  if (!target) return false;
  target.scrollIntoView({ behavior, block: 'start' });
  activeId.value = id;
  return true;
}

async function selectAnchor(id: string): Promise<void> {
  const hash = `#${id}`;
  if (route.hash !== hash) {
    selectingAnchor = true;
    try {
      await router.replace({
        path: route.path,
        query: route.query,
        hash,
        state: route.state,
      });
    } finally {
      selectingAnchor = false;
    }
  }
  scrollToAnchor(id, reducedMotion.value ? 'auto' : 'smooth');
}

async function initializeReading(): Promise<void> {
  await nextTick();
  scrollContainer.value = findScrollContainer(root.value!);
  const anchorId = hashAnchorId();
  if (!anchorId || !scrollToAnchor(anchorId, 'auto')) updateActiveId();
}

useEventListener(scrollContainer, 'scroll', updateActiveId, { passive: true });
useEventListener(window, 'resize', updateActiveId, { passive: true });

watch(() => props.document, initializeReading, { flush: 'post' });
watch(() => route.hash, async () => {
  if (selectingAnchor) return;
  await nextTick();
  const anchorId = hashAnchorId();
  if (!anchorId || !scrollToAnchor(anchorId, 'auto')) updateActiveId();
});

onMounted(initializeReading);
</script>

<template>
  <section
    ref="root"
    class="article-rich-body"
    :class="{ 'article-rich-body--with-toc': headings.length }"
  >
    <RichArticleRenderer :document="document" class="article-rich-body__content" />
    <ArticleTableOfContents
      v-if="headings.length"
      :headings="headings"
      :active-id="activeId"
      @select="selectAnchor"
    />
  </section>
</template>

<style scoped>
.article-rich-body {
  min-width: 0;
}

.article-rich-body__content {
  min-width: 0;
}

.article-rich-body :deep([data-anchorid]) {
  scroll-margin-top: 1rem;
}

@media (min-width: 1180px) {
  .article-rich-body--with-toc {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 11.5rem;
    gap: clamp(1.5rem, 3vw, 2.6rem);
    align-items: start;
  }
}
</style>
