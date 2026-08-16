<script setup lang="ts">
defineProps<{
  html: string;
}>();
</script>

<template>
  <article class="markdown-resume" v-html="html" />
</template>

<style scoped>
.markdown-resume {
  width: min(100%, var(--reading-width));
  margin: 0 auto;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.9;
  overflow-wrap: anywhere;
}

.markdown-resume :deep(h1),
.markdown-resume :deep(h2),
.markdown-resume :deep(h3),
.markdown-resume :deep(h4),
.markdown-resume :deep(h5),
.markdown-resume :deep(h6) {
  margin: 2rem 0 0.75rem;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-weight: 750;
  line-height: 1.35;
}

.markdown-resume :deep(h1) {
  font-size: 1.75rem;
}

.markdown-resume :deep(h2) {
  font-size: 1.4rem;
}

.markdown-resume :deep(h3) {
  font-size: 1.2rem;
}

.markdown-resume :deep(h4),
.markdown-resume :deep(h5),
.markdown-resume :deep(h6) {
  font-size: 1.05rem;
}

.markdown-resume :deep(p) {
  margin: 0.9rem 0;
}

.markdown-resume :deep(ul),
.markdown-resume :deep(ol) {
  margin: 0.9rem 0;
  padding-left: 1.5rem;
}

.markdown-resume :deep(li) {
  margin: 0.3rem 0;
}

.markdown-resume :deep(blockquote) {
  margin: 1rem 0;
  padding: 0.25rem 0 0.25rem 1rem;
  border-left: 3px solid var(--accent);
  color: var(--text-muted);
}

.markdown-resume :deep(hr) {
  margin: 1.6rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}

.markdown-resume :deep(a) {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-resume :deep(a:hover) {
  color: var(--accent);
}

.markdown-resume :deep(strong) {
  font-weight: 750;
}

.markdown-resume :deep(s) {
  text-decoration: line-through;
}

.markdown-resume :deep(code) {
  padding: 0.15em 0.35em;
  border-radius: 0.35rem;
  background: var(--surface-muted);
  font-family: var(--font-mono);
  font-size: 0.86em;
}

.markdown-resume :deep(pre) {
  margin: 1rem 0;
  padding: 1rem;
  border-radius: var(--radius-card);
  background: var(--surface-muted);
  overflow-x: auto;
}

.markdown-resume :deep(pre code) {
  padding: 0;
  background: transparent;
  line-height: 1.7;
}

.markdown-resume :deep(table) {
  width: 100%;
  margin: 1rem 0;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: 0.85rem;
}

.markdown-resume :deep(th),
.markdown-resume :deep(td) {
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--border-subtle);
  text-align: left;
}

.markdown-resume :deep(th) {
  background: var(--surface-muted);
  font-weight: 700;
}

.markdown-resume :deep(tbody tr:nth-child(even)) {
  background: color-mix(in srgb, var(--surface-muted) 55%, transparent);
}
</style>