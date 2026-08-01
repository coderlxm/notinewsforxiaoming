<script setup lang="ts">
import type { SiteContactKind } from '../../types';

defineProps<{
  kind: SiteContactKind;
}>();
</script>

<template>
  <!-- Tabler Icons, Copyright (c) 2020-2026 Paweł Kuna, MIT License. -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="kind === 'telegram'">
      <path d="M15 10l-4 4l6 6l4 -16l-18 7l4 2l2 6l3 -4" />
    </template>
    <template v-else-if="kind === 'email'">
      <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
      <path d="M3 7l9 6l9 -6" />
    </template>
    <template v-else-if="kind === 'wechat'">
      <path d="M16.5 10c3.038 0 5.5 2.015 5.5 4.5c0 1.397 -.778 2.645 -2 3.47l0 2.03l-1.964 -1.178a6.649 6.649 0 0 1 -1.536 .178c-3.038 0 -5.5 -2.015 -5.5 -4.5s2.462 -4.5 5.5 -4.5" />
      <path d="M11.197 15.698c-.69 .196 -1.43 .302 -2.197 .302a8.008 8.008 0 0 1 -2.612 -.432l-2.388 1.432v-2.801c-1.237 -1.082 -2 -2.564 -2 -4.199c0 -3.314 3.134 -6 7 -6c3.782 0 6.863 2.57 7 5.785l0 .233" />
      <path d="M10 8h.01M7 8h.01M15 14h.01M18 14h.01" />
    </template>
    <template v-else-if="kind === 'github'">
      <path d="M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5" />
    </template>
    <template v-else>
      <path d="M19.5 7a9 9 0 0 0 -7.5 -4a8.991 8.991 0 0 0 -7.484 4" />
      <path d="M11.5 3a16.989 16.989 0 0 0 -1.826 4M12.5 3a16.989 16.989 0 0 1 1.828 4" />
      <path d="M19.5 17a9 9 0 0 1 -7.5 4a8.991 8.991 0 0 1 -7.484 -4" />
      <path d="M11.5 21a16.989 16.989 0 0 1 -1.826 -4M12.5 21a16.989 16.989 0 0 0 1.828 -4" />
      <path d="M2 10l1 4l1.5 -4l1.5 4l1 -4M17 10l1 4l1.5 -4l1.5 4l1 -4M9.5 10l1 4l1.5 -4l1.5 4l1 -4" />
    </template>
  </svg>
</template>
