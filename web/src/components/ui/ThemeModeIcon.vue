<script setup lang="ts">
import type { ThemeMode } from '../../theme/types';

defineProps<{
  mode: ThemeMode;
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
    <template v-if="mode === 'light'">
      <path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
      <path d="M4 12h-1M12 4v-1M20 12h1M12 20v1M6.31 6.31l-.71 -.71M17.69 6.31l.71 -.71M17.69 17.69l.71 .71M6.31 17.69l-.71 .71" />
    </template>
    <template v-else-if="mode === 'dark'">
      <path d="M12 3c.132 0 .263 .003 .393 .008a7.5 7.5 0 0 0 7.599 9.599a9 9 0 1 1 -7.999 -9.599z" />
    </template>
    <template v-else>
      <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z" />
      <path d="M7 21h10M9 17v4M15 17v4" />
    </template>
  </svg>
</template>
