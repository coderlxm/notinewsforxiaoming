<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `about-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Smiley Avatar / 个人与介绍) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系头部圆轮廓 -->
    <circle
      cx="12"
      cy="7.5"
      r="4"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
    />
    <!-- 头部可爱微笑弧线 -->
    <path
      d="M10.2 8C10.2 9.1 11 9.8 12 9.8C13 9.8 13.8 9.1 13.8 8"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
    />
    <!-- 萌系身体与肩膀圆弧 -->
    <path
      d="M4.5 20.2C4.5 16.2 8 13.5 12 13.5C16 13.5 19.5 16.2 19.5 20.2"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Mint to Cyan Avatar Badge) -->
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
        <stop offset="0%" stop-color="#34D399" />
        <stop offset="35%" stop-color="#10B981" />
        <stop offset="70%" stop-color="#06B6D4" />
        <stop offset="100%" stop-color="#3B82F6" />
      </linearGradient>
    </defs>

    <circle
      cx="12"
      cy="7.5"
      r="3.8"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M4.5 19.5C4.5 15.634 7.85786 13.25 12 13.25C16.1421 13.25 19.5 15.634 19.5 19.5C19.5 20.3284 18.8284 21 18 21H6C5.17157 21 4.5 20.3284 4.5 19.5Z"
      :fill="`url(#${gradientId})`"
    />
    <circle
      cx="13.2"
      cy="6.3"
      r="1.1"
      fill="#FFFFFF"
      fill-opacity="0.9"
    />
    <path
      d="M10 16.8L12 18.8L14 16.8"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.9"
    />
  </svg>
</template>
