<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `life-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Smiling House / 治愈小家与生活) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系大圆角小房子轮廓 -->
    <path
      d="M12 3.2L3.8 9.8C3.3 10.2 3 10.8 3 11.5V18.5C3 19.9 4.1 21 5.5 21H18.5C19.9 21 21 19.9 21 18.5V11.5C21 10.8 20.7 10.2 20.2 9.8L12 3.2Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 治愈微笑弧线 -->
    <path
      d="M9 14.5C9 16.2 10.3 17.2 12 17.2C13.7 17.2 15 16.2 15 14.5"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
    />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Warm Morning Coffee & Saucer) -->
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
        y1="3"
        x2="22"
        y2="21"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#FF5E62" />
        <stop offset="35%" stop-color="#FF7E40" />
        <stop offset="70%" stop-color="#F59E0B" />
        <stop offset="100%" stop-color="#FBBF24" />
      </linearGradient>
    </defs>

    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M4 8.5C4 7.67157 4.67157 7 5.5 7H15.5C16.3284 7 17 7.67157 17 8.5V13.5C17 16.5376 14.5376 19 11.5 19H9.5C6.46243 19 4 16.5376 4 13.5V8.5ZM17 9.5H18C19.6569 9.5 21 10.8431 21 12.5C21 14.1569 19.6569 15.5 18 15.5H17V13.5H18C18.5523 13.5 19 13.0523 19 12.5C19 11.9477 18.5523 11.5 18 11.5H17V9.5Z"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M3 20.5C3 19.9477 3.44772 19.5 4 19.5H17C17.5523 19.5 18 19.9477 18 20.5C18 21.0523 17.5523 21.5 17 21.5H4C3.44772 21.5 3 21.0523 3 20.5Z"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M7.5 5C7.5 3.8 8.8 3.2 8.8 2M11 5C11 3.8 12.3 3.2 12.3 2M14.5 5C14.5 3.8 15.8 3.2 15.8 2"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.92"
    />
    <path
      d="M6.5 10V14C6.5 15.38 7.62 16.5 9 16.5"
      stroke="#FFFFFF"
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-opacity="0.45"
    />
    <circle cx="10.5" cy="11.5" r="1" fill="#FFFFFF" fill-opacity="0.9" />
  </svg>
</template>
