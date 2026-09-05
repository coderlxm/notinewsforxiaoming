<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `life-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Warm Morning Coffee & Daily Life Moments Theme -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：晨曦暖阳 (温暖珊瑚红 -> 晨曦橙 -> 琥珀金 -> 暖阳金黄) -->
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

    <!-- 咖啡杯身与饱满把手一体化外轮廓 -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M4 8.5C4 7.67157 4.67157 7 5.5 7H15.5C16.3284 7 17 7.67157 17 8.5V13.5C17 16.5376 14.5376 19 11.5 19H9.5C6.46243 19 4 16.5376 4 13.5V8.5ZM17 9.5H18C19.6569 9.5 21 10.8431 21 12.5C21 14.1569 19.6569 15.5 18 15.5H17V13.5H18C18.5523 13.5 19 13.0523 19 12.5C19 11.9477 18.5523 11.5 18 11.5H17V9.5Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 底托杯碟 (Saucer base) -->
    <path
      d="M3 20.5C3 19.9477 3.44772 19.5 4 19.5H17C17.5523 19.5 18 19.9477 18 20.5C18 21.0523 17.5523 21.5 17 21.5H4C3.44772 21.5 3 21.0523 3 20.5Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 缕缕热气曲线 (Rising steam wisps) -->
    <path
      d="M7.5 5C7.5 3.8 8.8 3.2 8.8 2M11 5C11 3.8 12.3 3.2 12.3 2M14.5 5C14.5 3.8 15.8 3.2 15.8 2"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.92"
    />

    <!-- 杯身弧光高光 (Cup specular highlight) -->
    <path
      d="M6.5 10V14C6.5 15.38 7.62 16.5 9 16.5"
      stroke="#FFFFFF"
      stroke-width="1.3"
      stroke-linecap="round"
      stroke-opacity="0.45"
    />

    <!-- 杯中微小拉花亮点 (Coffee spark dot) -->
    <circle cx="10.5" cy="11.5" r="1" fill="#FFFFFF" fill-opacity="0.9" />
  </svg>
</template>
