<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `gemini-sparkle-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Gemini Style Sparkle Multi-color Gradient Icon -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="gradientId"
        x1="2"
        y1="2"
        x2="22"
        y2="22"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#4E80EE" />
        <stop offset="32%" stop-color="#8B5CF6" />
        <stop offset="68%" stop-color="#EC4899" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>
    </defs>
    <!-- 主星芒 -->
    <path
      d="M12 2C12 7.523 16.477 12 22 12C16.477 12 12 16.477 12 22C12 16.477 7.523 12 2 12C7.523 12 12 7.523 12 2Z"
      :fill="`url(#${gradientId})`"
    />
    <!-- 伴生小星芒 -->
    <path
      d="M19 1.5C19 3.16 20.34 4.5 22 4.5C20.34 4.5 19 5.84 19 7.5C19 5.84 17.66 4.5 16 4.5C17.66 4.5 19 3.16 19 1.5Z"
      :fill="`url(#${gradientId})`"
      opacity="0.9"
    />
  </svg>
</template>
