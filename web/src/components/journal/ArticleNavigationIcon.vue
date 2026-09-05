<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `article-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Intellectual Knowledge & Editorial Reading Theme -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：智识深邃之蓝 (天空蔚蓝 -> 极客蓝 -> 靛青 -> 优雅紫) -->
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

    <!-- 展开的书籍主体轮廓 -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M3 5.5C3 4.11929 4.11929 3 5.5 3C8.42398 3 10.741 4.14856 12 5.37877C13.259 4.14856 15.576 3 18.5 3C19.8807 3 21 4.11929 21 5.5V17.5C21 18.8807 19.8807 20 18.5 20C15.8277 20 13.626 20.9572 12.4497 21.8497C12.1852 22.0504 11.8148 22.0504 11.5503 21.8497C10.374 20.9572 8.1723 20 5.5 20C4.11929 20 3 18.8807 3 17.5V5.5Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 书脊中央暗色分割缝 -->
    <path
      d="M12 5.5V20.5"
      stroke="#0c0d12"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-opacity="0.85"
    />

    <!-- 左页文章排版横线 -->
    <path
      d="M5.5 7.5H9.5M5.5 11H9.5M5.5 14.5H8"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <!-- 右页文章排版横线 -->
    <path
      d="M14.5 7.5H18.5M14.5 11H18.5M14.5 14.5H16.5"
      stroke="#FFFFFF"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-opacity="0.9"
    />

    <!-- 顶部亮色书签丝带 -->
    <path
      d="M12 3V9L13.5 7.8L15 9V3H12Z"
      fill="#FACC15"
      fill-opacity="0.95"
    />
  </svg>
</template>
