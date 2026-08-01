<script setup lang="ts">
import { computed, onActivated, onMounted, onUpdated, useTemplateRef } from 'vue';

const props = defineProps<{
  tags: readonly string[];
  activeTag: string;
}>();

const emit = defineEmits<{
  select: [tag: string];
}>();

const navigation = useTemplateRef<HTMLElement>('navigation');
const visible = computed(() => props.tags.length > 0 || props.activeTag.length > 0);
const navigationTags = computed(() => {
  if (!props.activeTag || props.tags.includes(props.activeTag)) return props.tags;
  return [...props.tags, props.activeTag];
});

function selectTag(tag: string): void {
  if (tag === props.activeTag) return;
  emit('select', tag);
}

function keepActiveTagVisible(): void {
  const container = navigation.value;
  if (!container) return;
  const button = container.querySelector<HTMLButtonElement>('[aria-current="page"]');
  if (!button) return;

  const containerRect = container.getBoundingClientRect();
  const buttonRect = button.getBoundingClientRect();
  if (buttonRect.left < containerRect.left) {
    container.scrollTo({
      left: container.scrollLeft - (containerRect.left - buttonRect.left),
      behavior: 'auto',
    });
  }
  else if (buttonRect.right > containerRect.right) {
    container.scrollTo({
      left: container.scrollLeft + buttonRect.right - containerRect.right,
      behavior: 'auto',
    });
  }
}

onMounted(keepActiveTagVisible);
onUpdated(keepActiveTagVisible);
onActivated(keepActiveTagVisible);
</script>

<template>
  <nav v-if="visible" ref="navigation" class="public-tag-navigation" aria-label="当前频道标签">
    <button
      class="public-tag-navigation__item"
      :class="{ 'public-tag-navigation__item--active': activeTag === '' }"
      type="button"
      :aria-current="activeTag === '' ? 'page' : undefined"
      @click="selectTag('')"
    >
      全部
    </button>
    <button
      v-for="tag in navigationTags"
      :key="tag"
      class="public-tag-navigation__item"
      :class="{ 'public-tag-navigation__item--active': tag === activeTag }"
      type="button"
      :aria-current="tag === activeTag ? 'page' : undefined"
      @click="selectTag(tag)"
    >
      {{ tag }}
    </button>
  </nav>
</template>

<style scoped>
.public-tag-navigation {
  display: flex;
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  gap: 0.35rem;
  white-space: nowrap;
}

.public-tag-navigation::-webkit-scrollbar {
  display: none;
}

.public-tag-navigation__item {
  flex: 0 0 auto;
  min-height: 2rem;
  padding: 0.38rem 0.75rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 650;
}

.public-tag-navigation__item:hover,
.public-tag-navigation__item:focus-visible {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.public-tag-navigation__item--active,
.public-tag-navigation__item--active:hover,
.public-tag-navigation__item--active:focus-visible {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.public-tag-navigation__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
