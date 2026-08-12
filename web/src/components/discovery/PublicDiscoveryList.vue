<script setup lang="ts">
import type { JournalDiscoveryListItem } from '../../types';
import PublicDiscoveryItem from './PublicDiscoveryItem.vue';

withDefaults(defineProps<{
  entries: readonly JournalDiscoveryListItem[];
  query?: string;
}>(), {
  query: '',
});

const emit = defineEmits<{
  open: [entry: JournalDiscoveryListItem];
}>();
</script>

<template>
  <div class="discovery-list">
    <PublicDiscoveryItem
      v-for="entry in entries"
      :key="`${entry.kind}:${entry.publicId}`"
      :entry="entry"
      :query="query"
      @open="emit('open', $event)"
    />
  </div>
</template>

<style scoped>
.discovery-list {
  display: grid;
  min-width: 0;
}
</style>
