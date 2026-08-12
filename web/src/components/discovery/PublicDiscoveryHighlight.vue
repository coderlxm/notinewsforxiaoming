<script setup lang="ts">
import { computed } from 'vue';

interface HighlightSegment {
  text: string;
  highlighted: boolean;
}

const props = defineProps<{
  text: string;
  query: string;
}>();

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function asciiInsensitivePattern(value: string): string {
  return [...value].map((character) => {
    if (character >= 'a' && character <= 'z') {
      return `[${character}${character.toUpperCase()}]`;
    }
    if (character >= 'A' && character <= 'Z') {
      return `[${character.toLowerCase()}${character}]`;
    }
    return escapeRegularExpression(character);
  }).join('');
}

const segments = computed<readonly HighlightSegment[]>(() => {
  const query = props.query.trim().replace(/\s+/gu, ' ');
  if (!query) return [{ text: props.text, highlighted: false }];

  const terms = [...new Set([query, ...query.split(' ')])]
    .sort((left, right) => right.length - left.length)
    .map(asciiInsensitivePattern);
  const matcher = new RegExp(terms.join('|'), 'gu');
  const parts: HighlightSegment[] = [];
  let cursor = 0;

  for (const match of props.text.matchAll(matcher)) {
    const index = match.index!;
    if (index > cursor) {
      parts.push({ text: props.text.slice(cursor, index), highlighted: false });
    }
    parts.push({ text: match[0], highlighted: true });
    cursor = index + match[0].length;
  }

  if (cursor < props.text.length) {
    parts.push({ text: props.text.slice(cursor), highlighted: false });
  }
  return parts.length ? parts : [{ text: props.text, highlighted: false }];
});
</script>

<template>
  <template v-for="(segment, index) in segments" :key="`${index}:${segment.text}`">
    <mark v-if="segment.highlighted" class="discovery-highlight">{{ segment.text }}</mark>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>

<style scoped>
.discovery-highlight {
  padding: 0 0.08em;
  border-radius: 0.18em;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}
</style>
