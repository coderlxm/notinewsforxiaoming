<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `gemini-sparkle-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Sparkle / 灵感与智能) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系四芒星圆弧轮廓 -->
    <path
      d="M12 2.8C12 7.2 15.8 11 20.2 11C15.8 11 12 14.8 12 19.2C12 14.8 8.2 11 3.8 11C8.2 11 12 7.2 12 2.8Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 伴生可爱小圆点晶星 -->
    <circle cx="18.5" cy="5.5" r="1.5" fill="currentColor" />
    <circle cx="5.5" cy="18.5" r="1.1" fill="currentColor" />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Gemini Multi-color Sparkle) -->
  <svg
    v-else
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
    <path
      d="M12 2C12 7.523 16.477 12 22 12C16.477 12 12 16.477 12 22C12 16.477 7.523 12 2 12C7.523 12 12 7.523 12 2Z"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M19 1.5C19 3.16 20.34 4.5 22 4.5C20.34 4.5 19 5.84 19 7.5C19 5.84 17.66 4.5 16 4.5C17.66 4.5 19 3.16 19 1.5Z"
      :fill="`url(#${gradientId})`"
      opacity="0.9"
    />
  </svg>
</template>
