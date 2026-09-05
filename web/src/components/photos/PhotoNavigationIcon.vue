<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `photo-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
const lensGradientId = `photo-lens-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Camera / 摄影与精选集) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系微胖圆角矩形机身 -->
    <rect
      x="3"
      y="5.5"
      width="13.5"
      height="13"
      rx="4.2"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 侧边放映头/镜头凸起 (与参考图一致) -->
    <path
      d="M16.5 9.8L21 7.2V16.8L16.5 14.2"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 镜头内部可爱播放三角/同心圆 -->
    <path
      d="M8.5 9.5L12.5 12L8.5 14.5V9.5Z"
      fill="currentColor"
    />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Photographic Optics & Golden Sunset) -->
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
        <stop offset="35%" stop-color="#06B6D4" />
        <stop offset="70%" stop-color="#10B981" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>

      <linearGradient
        :id="lensGradientId"
        x1="8"
        y1="9.5"
        x2="16"
        y2="17.5"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#0284C7" />
        <stop offset="60%" stop-color="#0D9488" />
        <stop offset="100%" stop-color="#F59E0B" />
      </linearGradient>
    </defs>

    <path
      d="M4 7C2.89543 7 2 7.89543 2 9V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7H16.8L15.6 4.6C15.228 3.856 14.472 3.4 13.64 3.4H10.36C9.528 3.4 8.772 3.856 8.4 4.6L7.2 7H4Z"
      :fill="`url(#${gradientId})`"
    />
    <circle
      cx="12"
      cy="13.5"
      r="4.25"
      fill="#0c0d12"
      fill-opacity="0.88"
    />
    <circle
      cx="12"
      cy="13.5"
      r="3"
      :fill="`url(#${lensGradientId})`"
    />
    <circle
      cx="13.2"
      cy="12.3"
      r="0.9"
      fill="#FFFFFF"
      fill-opacity="0.9"
    />
    <circle
      cx="18.5"
      cy="9.8"
      r="1.2"
      fill="#FFFFFF"
      fill-opacity="0.85"
    />
  </svg>
</template>
