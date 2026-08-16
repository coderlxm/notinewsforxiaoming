<script setup lang="ts">
defineProps<{
  html: string;
}>();
</script>

<template>
  <article class="markdown-resume">
    <div class="markdown-resume__paper" v-html="html" />
  </article>
</template>

<style scoped>
.markdown-resume {
  width: 100%;
  margin: 0 auto;
}

.markdown-resume__paper {
  width: 100%;
  padding: clamp(1.8rem, 5vw, 3.6rem);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow:
    0 10px 24px color-mix(in srgb, var(--ink) 6%, transparent),
    0 0 0 1px var(--border-subtle);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.94rem;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.markdown-resume__paper :deep(h1) {
  margin: 0 0 1.2rem;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1.5rem, 3.5vw, 1.95rem);
  font-weight: 750;
  line-height: 1.25;
}

.markdown-resume__paper :deep(h2) {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 2.2rem 0 1rem;
  padding-bottom: 0.45rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 1.22rem;
  font-weight: 750;
  letter-spacing: 0.03em;
}

.markdown-resume__paper :deep(h2)::before {
  content: '';
  display: inline-block;
  width: 0.4rem;
  height: 1.1rem;
  border-radius: 2px;
  background: var(--accent);
  flex: none;
}

.markdown-resume__paper :deep(h2:first-child) {
  margin-top: 0;
}

.markdown-resume__paper :deep(h3) {
  margin: 1.4rem 0 0.4rem;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 750;
  line-height: 1.35;
}

.markdown-resume__paper :deep(h4),
.markdown-resume__paper :deep(h5),
.markdown-resume__paper :deep(h6) {
  margin: 1rem 0 0.35rem;
  color: var(--text-primary);
  font-size: 0.92rem;
  font-weight: 700;
}

.markdown-resume__paper :deep(p) {
  margin: 0.55rem 0;
}

.markdown-resume__paper :deep(h3 + p) {
  margin-top: -0.15rem;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.85rem;
  letter-spacing: 0.02em;
}

.markdown-resume__paper :deep(ul),
.markdown-resume__paper :deep(ol) {
  margin: 0.6rem 0 1rem;
  padding-left: 1.25rem;
}

.markdown-resume__paper :deep(li) {
  margin: 0.35rem 0;
  padding-left: 0.2rem;
  line-height: 1.7;
}

.markdown-resume__paper :deep(li::marker) {
  color: var(--accent);
}

.markdown-resume__paper :deep(blockquote) {
  margin: 0.9rem 0;
  padding: 0.4rem 0.8rem;
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius-media) var(--radius-media) 0;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 0.88rem;
}

.markdown-resume__paper :deep(hr) {
  margin: 1.8rem 0;
  border: 0;
  border-top: 1px solid var(--border-subtle);
}

.markdown-resume__paper :deep(a) {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 3px;
  transition: color 140ms ease;
}

.markdown-resume__paper :deep(a:hover) {
  color: var(--accent);
}

.markdown-resume__paper :deep(strong) {
  color: var(--text-primary);
  font-weight: 750;
}

.markdown-resume__paper :deep(s) {
  color: var(--text-muted);
  text-decoration: line-through;
}

.markdown-resume__paper :deep(code) {
  display: inline-block;
  padding: 0.12em 0.45em;
  margin: 0.1em 0.15em;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.84em;
  font-weight: 600;
}

.markdown-resume__paper :deep(pre) {
  margin: 0.9rem 0;
  padding: 0.9rem 1.1rem;
  border-radius: var(--radius-card);
  background: var(--surface-muted);
  overflow-x: auto;
}

.markdown-resume__paper :deep(pre code) {
  display: block;
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  font-family: var(--font-sans);
  line-height: 1.6;
}

.markdown-resume__paper :deep(table) {
  width: 100%;
  margin: 1.2rem 0;
  border-collapse: collapse;
  font-size: 0.86rem;
}

.markdown-resume__paper :deep(th),
.markdown-resume__paper :deep(td) {
  padding: 0.55rem 0.8rem;
  border: 1px solid var(--border-subtle);
  text-align: left;
}

.markdown-resume__paper :deep(th) {
  background: var(--surface-muted);
  color: var(--text-primary);
  font-weight: 700;
}

.markdown-resume__paper :deep(tbody tr:nth-child(even)) {
  background: color-mix(in srgb, var(--surface-muted) 45%, transparent);
}

@media (max-width: 599px) {
  .markdown-resume__paper {
    padding: 1.4rem 1.1rem;
    border-radius: 10px;
    font-size: 0.9rem;
  }

  .markdown-resume__paper :deep(h2) {
    margin: 1.6rem 0 0.8rem;
    font-size: 1.1rem;
  }

  .markdown-resume__paper :deep(ul),
  .markdown-resume__paper :deep(ol) {
    padding-left: 1rem;
  }
}
</style>