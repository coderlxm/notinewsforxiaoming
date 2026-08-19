<script setup lang="ts">
import { useEventListener } from '@vueuse/core';
import { onScopeDispose, shallowRef, useTemplateRef } from 'vue';
import { useRoute, useRouter, type RouteLocationNormalized } from 'vue-router';
import { normalizePublicSearchQuery, publicSearchPath } from './discoveryRoutes';

const MAX_QUERY_LENGTH = 80;

const currentRoute = useRoute();
const router = useRouter();
const input = useTemplateRef<HTMLInputElement>('input');
const query = shallowRef(readRouteQuery(currentRoute));
const composing = shallowRef(false);

function limitQuery(value: string): string {
  return Array.from(value).slice(0, MAX_QUERY_LENGTH).join('');
}

function readRouteQuery(route: RouteLocationNormalized): string {
  if (route.name !== 'search' || typeof route.query.q !== 'string') return '';
  return limitQuery(normalizePublicSearchQuery(route.query.q));
}

function handleInput(event: Event): void {
  const element = event.currentTarget as HTMLInputElement;
  if (composing.value) {
    query.value = element.value;
    return;
  }
  const nextQuery = limitQuery(element.value);
  query.value = nextQuery;
  if (nextQuery !== element.value) element.value = nextQuery;
}

function handleCompositionStart(): void {
  composing.value = true;
}

function handleCompositionEnd(event: CompositionEvent): void {
  composing.value = false;
  handleInput(event);
}

function submitSearch(): void {
  if (composing.value) return;
  const normalizedQuery = limitQuery(normalizePublicSearchQuery(query.value));
  query.value = normalizedQuery;
  void router.push(publicSearchPath(normalizedQuery));
}

function handleEnter(event: KeyboardEvent): void {
  if (event.isComposing || composing.value) return;
  event.preventDefault();
  submitSearch();
}

function isEditable(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  return element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
    || element.isContentEditable
    || element.closest('[contenteditable="true"], [contenteditable="plaintext-only"]') !== null;
}

function handleSearchShortcut(event: KeyboardEvent): void {
  if (event.key.toLowerCase() !== 'k' || (!event.metaKey && !event.ctrlKey)) return;
  if (event.altKey || event.shiftKey) return;
  if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;

  const activeElement = document.activeElement;
  if (activeElement !== input.value && isEditable(activeElement)) return;

  event.preventDefault();
  input.value!.focus();
  input.value!.select();
}

const removeAfterEach = router.afterEach((to) => {
  query.value = readRouteQuery(to);
});

useEventListener('keydown', handleSearchShortcut);

onScopeDispose(removeAfterEach);
</script>

<template>
  <form class="public-search" role="search" aria-label="搜索公开内容" @submit.prevent="submitSearch">
    <input
      ref="input"
      class="public-search__input"
      type="search"
      name="q"
      :value="query"
      placeholder="搜索公开记录和文章"
      autocomplete="off"
      enterkeyhint="search"
      aria-label="搜索公开记录和文章"
      @input="handleInput"
      @keydown.enter="handleEnter"
      @compositionstart="handleCompositionStart"
      @compositionend="handleCompositionEnd"
    >
    <button class="public-search__submit" type="submit" aria-label="提交搜索">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
    </button>
  </form>
</template>

<style scoped>
.public-search {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 2.8rem;
  align-items: center;
  padding: 0 0.45rem 0 1rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface-muted) 78%, var(--surface-card));
  transition: border-color 150ms ease, background-color 150ms ease, box-shadow 150ms ease;
}

.public-search:hover {
  background: var(--surface-muted);
}

.public-search:focus-within {
  border-color: color-mix(in srgb, var(--accent) 42%, transparent);
  background: var(--surface-card);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent);
}

.public-search__input {
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.88rem;
}

.public-search__input:focus {
  border-color: transparent;
}

.public-search__input:focus-visible {
  outline: 0;
}

.public-search__input::placeholder {
  color: var(--text-muted);
  opacity: 0.82;
}

.public-search__input::-webkit-search-cancel-button {
  cursor: pointer;
}

.public-search__submit {
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  place-items: center;
  transition: background-color 140ms ease, color 140ms ease;
}

.public-search__submit:hover,
.public-search__submit:focus-visible {
  background: var(--surface-card);
  color: var(--accent-strong);
}

.public-search__submit svg {
  width: 1.2rem;
  height: 1.2rem;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@media (max-width: 599px) {
  .public-search {
    height: 2.55rem;
  }

  .public-search__input {
    font-size: 16px;
  }
}
</style>
