<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `article-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Book / 知识书卷与阅读) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系圆角书本/文档外框 -->
    <path
      d="M4.5 19.5V5.5C4.5 4.1 5.6 3 7 3H17C18.4 3 19.5 4.1 19.5 5.5V18.5C19.5 19.9 18.4 21 17 21H6C5.2 21 4.5 20.3 4.5 19.5Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 书内圆润排版横线 -->
    <path
      d="M8.5 7.8H15.5M8.5 11.8H15.5"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
    />
    <!-- 萌系微笑小书签/微弧线条 -->
    <path
      d="M8.5 15.8C9.6 16.6 11.2 16.6 12.5 15.8"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
    />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Open Intellectual Book) -->
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
        <stop offset="0%" stop-color="#0284C7" />
        <stop offset="35%" stop-color="#2563EB" />
        <stop offset="70%" stop-color="#6366F1" />
        <stop offset="100%" stop-color="#8B5CF6" />
      </linearGradient>
    </defs>

    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M3 5.5C3 4.11929 4.11929 3 5.5 3C8.42398 3 10.741 4.14856 12 5.37877C13.259 4.14856 15.576 3 18.5 3C19.8807 3 21 4.11929 21 5.5V17.5C21 18.8807 19.8807 20 18.5 20C15.8277 20 13.626 20.9572 12.4497 21.8497C12.1852 22.0504 11.8148 22.0504 11.5503 21.8497C10.374 20.9572 8.1723 20 5.5 20C4.11929 20 3 18.8807 3 17.5V5.5Z"
      :fill="`url(#${gradientId})`"
    />
    <path
      d="M12 5.5V20.5"
      stroke="#0c0d12"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-opacity="0.85"
    />
    <path
      d="M5.5 7.5H9.5M5.5 11H9.5M5.5 14.5H8"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />
    <path
      d="M14.5 7.5H18.5M14.5 11H18.5M14.5 14.5H16.5"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />
    <path
      d="M12 3V9L13.5 7.8L15 9V3H12Z"
      fill="#FACC15"
      fill-opacity="0.95"
    />
  </svg>
</template>
