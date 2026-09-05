<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `game-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Gamepad / 游戏与成就) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系微胖手柄轮廓 -->
    <path
      d="M7 6C4.8 6 3 7.8 3 10C3 13 4 16.8 5.2 18.8C5.6 19.5 6.5 19.8 7.3 19.4L9.2 18.5C9.8 18.2 10.5 18.4 11 18.9C11.4 19.3 12.6 19.3 13 18.9C13.5 18.4 14.2 18.2 14.8 18.5L16.7 19.4C17.5 19.8 18.4 19.5 18.8 18.8C20 16.8 21 13 21 10C21 7.8 19.2 6 17 6H7Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 左侧十字键 -->
    <path
      d="M7.5 9.5V13.5M5.5 11.5H9.5"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
    />
    <!-- 右侧按键实心圆点 -->
    <circle cx="16.5" cy="9.8" r="1.1" fill="currentColor" />
    <circle cx="14.7" cy="11.5" r="1.1" fill="currentColor" />
    <circle cx="18.3" cy="11.5" r="1.1" fill="currentColor" />
    <circle cx="16.5" cy="13.2" r="1.1" fill="currentColor" />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Cyber Gaming Neon Gradient) -->
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
        y1="5"
        x2="22"
        y2="19"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#00D2D3" />
        <stop offset="42%" stop-color="#2563EB" />
        <stop offset="78%" stop-color="#7C3AED" />
        <stop offset="100%" stop-color="#FF2A6D" />
      </linearGradient>
    </defs>

    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M7.5 4.5C5.01472 4.5 3 6.51472 3 9C3 12.3 3.9 16.4 5.3 18.7C5.8 19.5 6.8 19.9 7.7 19.5L9.6 18.6C10.3 18.3 11.1 18.5 11.6 19.1C11.8 19.3 12.2 19.3 12.4 19.1C12.9 18.5 13.7 18.3 14.4 18.6L16.3 19.5C17.2 19.9 18.2 19.5 18.7 18.7C20.1 16.4 21 12.3 21 9C21 6.51472 18.9853 4.5 16.5 4.5H7.5Z"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M7.5 7.5V12.5M5 10H10"
      stroke="#0c0d12"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <circle cx="16.5" cy="8.2" r="0.9" fill="#FACC15" />
    <circle cx="14.7" cy="10" r="0.9" fill="#38BDF8" />
    <circle cx="18.3" cy="10" r="0.9" fill="#FF4757" />
    <circle cx="16.5" cy="11.8" r="0.9" fill="#2ED573" />
    <circle cx="12" cy="7.5" r="0.9" fill="#FFFFFF" fill-opacity="0.85" />
  </svg>
</template>
