<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `guestbook-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Speech Bubble / 留言与互动，与参考图一致) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系微胖气泡轮廓 -->
    <path
      d="M12 3C6.5 3 2 7.1 2 12.2C2 14.5 2.9 16.6 4.5 18.2L3.5 21.2L7.2 20.2C8.7 20.8 10.3 21.2 12 21.2C17.5 21.2 22 17.1 22 12.2C22 7.1 17.5 3 12 3Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 气泡内 3 个可爱实心圆点 -->
    <circle cx="8" cy="12.2" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12.2" r="1.3" fill="currentColor" />
    <circle cx="16" cy="12.2" r="1.3" fill="currentColor" />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Rose Red Elegant Envelope) -->
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

    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
      :fill="`url(#${gradientId})`"
    />
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
