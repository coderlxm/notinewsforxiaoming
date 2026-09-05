<script setup lang="ts">
import { computed, useId } from 'vue';
import { type NavIconStyle, useNavIconStyle } from '../../composables/useNavIconStyle';

const props = defineProps<{
  variant?: NavIconStyle;
}>();

const { navIconStyle } = useNavIconStyle();
const activeStyle = computed(() => props.variant ?? navIconStyle.value);

const rawId = useId();
const gradientId = `interest-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Plan B: 粗线圆角萌系风 (Cute Rounded Palette / 艺术与爱好) -->
  <svg
    v-if="activeStyle === 'playful-line'"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- 萌系大圆角调色盘外框 -->
    <path
      d="M12 3C6.8 3 2.5 7.1 2.5 12.2C2.5 17.3 6.8 21.2 12 21.2C13.8 21.2 15 20 15 18.4C15 17.6 14.6 16.9 14.2 16.4C13.8 15.9 13.5 15.2 13.5 14.4C13.5 12.9 14.7 11.7 16.2 11.7H18C20.2 11.7 22 9.9 22 7.7C22 5.1 17.5 3 12 3Z"
      stroke="currentColor"
      stroke-width="2.3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- 调色盘可爱实心颜料点 -->
    <circle cx="7" cy="11.5" r="1.4" fill="currentColor" />
    <circle cx="9.5" cy="7.2" r="1.4" fill="currentColor" />
    <circle cx="14.5" cy="6.8" r="1.4" fill="currentColor" />
    <!-- 指孔 -->
    <circle cx="16.5" cy="17.2" r="1.5" stroke="currentColor" stroke-width="1.8" />
  </svg>

  <!-- Plan A: 多色渐变微质感风 (Vibrant Creative Gradient Palette) -->
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
        <stop offset="0%" stop-color="#8B5CF6" />
        <stop offset="36%" stop-color="#D946EF" />
        <stop offset="72%" stop-color="#F43F5E" />
        <stop offset="100%" stop-color="#FB923C" />
      </linearGradient>
    </defs>

    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C13.5 22 14.5 21 14.5 19.5C14.5 18.8 14.2 18.2 13.8 17.7C13.4 17.2 13.1 16.6 13.1 16C13.1 14.6 14.2 13.5 15.6 13.5H18C20.2091 13.5 22 11.7091 22 9.5C22 5.35786 17.5228 2 12 2Z"
      :fill="`url(#${gradientId})`"
    />
    <circle cx="16.5" cy="18" r="1.6" fill="#0c0d12" fill-opacity="0.88" />
    <circle cx="6.5" cy="11.5" r="1.3" fill="#FACC15" />
    <circle cx="8.5" cy="6.5" r="1.3" fill="#38BDF8" />
    <circle cx="14" cy="5.5" r="1.3" fill="#34D399" />
    <circle cx="18.5" cy="8.5" r="1.3" fill="#FFFFFF" fill-opacity="0.9" />
  </svg>
</template>
