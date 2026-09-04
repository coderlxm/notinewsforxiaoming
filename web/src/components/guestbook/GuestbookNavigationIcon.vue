<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `guestbook-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- 雅致信笺与书信折角，玫瑰红至典雅紫渐变 -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="gradientId"
        x1="3"
        y1="4"
        x2="21"
        y2="20"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#E11D48" />
        <stop offset="50%" stop-color="#BE185D" />
        <stop offset="100%" stop-color="#831843" />
      </linearGradient>
    </defs>

    <!-- 信封主体轮廓 -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 信封折翼与信笺横线 -->
    <path
      d="M5 6.5L12 12.2L19 6.5"
      stroke="#ffffff"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.92"
    />
    <path
      d="M8.5 15.5H15.5"
      stroke="#ffffff"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-opacity="0.85"
    />
  </svg>
</template>
