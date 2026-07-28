<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core';
import { useId, useTemplateRef, watch } from 'vue';
import type { ArticleHeading } from '../../utils/articleHeadings';

defineProps<{
  headings: readonly ArticleHeading[];
  activeId: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const trigger = useTemplateRef<HTMLButtonElement>('trigger');
const drawerTitleId = useId();
const isDesktop = useMediaQuery('(min-width: 960px)');

watch(isDesktop, (desktop) => {
  if (desktop && dialog.value?.open) dialog.value.close();
});

function openDrawer(): void {
  dialog.value!.showModal();
}

function closeDrawer(): void {
  dialog.value!.close();
}

function select(id: string): void {
  emit('select', id);
  if (dialog.value?.open) dialog.value.close();
}

function handleBackdropClick(event: MouseEvent): void {
  if (event.target === dialog.value) closeDrawer();
}

function restoreTriggerFocus(): void {
  trigger.value?.focus();
}
</script>

<template>
  <div class="article-toc__slot">
    <aside class="article-toc article-toc--desktop">
      <span class="article-toc__eyebrow">本文目录</span>
      <nav aria-label="文章目录">
        <a
          v-for="heading in headings"
          :key="heading.id"
          class="article-toc__link"
          :class="{ 'article-toc__link--nested': heading.level === 3 }"
          :href="`#${heading.id}`"
          :aria-current="heading.id === activeId ? 'location' : undefined"
          @click.prevent="select(heading.id)"
        >
          {{ heading.text }}
        </a>
      </nav>
    </aside>
  </div>

  <button
    ref="trigger"
    class="article-toc__trigger"
    type="button"
    aria-haspopup="dialog"
    @click="openDrawer"
  >
    目录
  </button>

  <dialog
    ref="dialog"
    class="article-toc__drawer"
    :aria-labelledby="drawerTitleId"
    @click="handleBackdropClick"
    @close="restoreTriggerFocus"
  >
    <div class="article-toc__drawer-panel">
      <header class="article-toc__drawer-heading">
        <h2 :id="drawerTitleId">本文目录</h2>
        <button type="button" aria-label="关闭目录" @click="closeDrawer">关闭</button>
      </header>
      <nav class="article-toc__drawer-links" aria-label="文章目录">
        <a
          v-for="heading in headings"
          :key="heading.id"
          class="article-toc__link article-toc__link--drawer"
          :class="{ 'article-toc__link--nested': heading.level === 3 }"
          :href="`#${heading.id}`"
          :aria-current="heading.id === activeId ? 'location' : undefined"
          @click.prevent="select(heading.id)"
        >
          {{ heading.text }}
        </a>
      </nav>
    </div>
  </dialog>
</template>

<style scoped>
.article-toc {
  position: fixed;
  z-index: 2;
  top: 50%;
  width: 12rem;
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  padding-left: 1rem;
  border-left: 1px solid var(--border-subtle);
  transform: translateY(-50%);
}

.article-toc__eyebrow {
  display: block;
  margin-bottom: 0.55rem;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.article-toc nav,
.article-toc__drawer-links {
  display: grid;
}

.article-toc__link {
  padding: 0.36rem 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
  text-decoration: none;
}

.article-toc__link--nested {
  padding-left: 0.8rem;
  font-size: 0.72rem;
}

.article-toc__link:hover,
.article-toc__link[aria-current="location"] {
  color: var(--accent-strong);
}

.article-toc__link[aria-current="location"] {
  font-weight: 750;
}

.article-toc__trigger,
.article-toc__drawer {
  display: none;
}

@media (max-width: 959px) {
  .article-toc__slot {
    display: none;
  }

  .article-toc__trigger {
    position: fixed;
    z-index: 12;
    right: max(16px, env(safe-area-inset-right));
    bottom: max(18px, env(safe-area-inset-bottom));
    display: block;
    min-width: 3.25rem;
    min-height: 3.25rem;
    padding: 0.55rem;
    border: 1px solid var(--border-strong);
    border-radius: 50%;
    background: var(--surface-card);
    color: var(--text-primary);
    box-shadow: 0 8px 24px rgb(20 20 18 / 18%);
    cursor: pointer;
  }

  .article-toc__drawer[open] {
    display: block;
    width: 100%;
    max-width: none;
    max-height: 72dvh;
    margin: auto 0 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 16px 16px 0 0;
    background: var(--surface-card);
    color: var(--text-primary);
  }

  .article-toc__drawer::backdrop {
    background: rgb(22 22 20 / 56%);
  }

  .article-toc__drawer-panel {
    display: grid;
    max-height: 72dvh;
    grid-template-rows: auto minmax(0, 1fr);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .article-toc__drawer-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--border-subtle);
  }

  .article-toc__drawer-heading h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.05rem;
  }

  .article-toc__drawer-heading button {
    min-height: 2.5rem;
    padding: 0.4rem 0.2rem;
    border: 0;
    background: transparent;
    color: var(--accent-strong);
    cursor: pointer;
  }

  .article-toc__drawer-links {
    padding: 0.55rem 1.1rem 1rem;
    overflow-y: auto;
  }

  .article-toc__link--drawer {
    min-height: 2.75rem;
    padding-top: 0.7rem;
    padding-bottom: 0.7rem;
    font-size: 0.9rem;
  }

  .article-toc__link--drawer.article-toc__link--nested {
    padding-left: 1rem;
    font-size: 0.84rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .article-toc__trigger {
    transition: none;
  }
}
</style>
