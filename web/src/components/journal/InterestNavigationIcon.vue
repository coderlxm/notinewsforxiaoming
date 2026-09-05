<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `interest-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Creative Arts, Hobbies & Exploration Theme -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：艺术创作与多元兴趣 (魅惑紫 -> 活力洋红 -> 亮粉 -> 珊瑚橙) -->
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

    <!-- 调色盘主体轮廓 -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C13.5 22 14.5 21 14.5 19.5C14.5 18.8 14.2 18.2 13.8 17.7C13.4 17.2 13.1 16.6 13.1 16C13.1 14.6 14.2 13.5 15.6 13.5H18C20.2091 13.5 22 11.7091 22 9.5C22 5.35786 17.5228 2 12 2Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 调色盘指孔暗色镂空 -->
    <circle cx="16.5" cy="18" r="1.6" fill="#0c0d12" fill-opacity="0.88" />

    <!-- 4 色经典颜料晶点 -->
    <circle cx="6.5" cy="11.5" r="1.3" fill="#FACC15" />  <!-- 明黄 (Yellow) -->
    <circle cx="8.5" cy="6.5" r="1.3" fill="#38BDF8" />   <!-- 亮蓝 (Blue) -->
    <circle cx="14" cy="5.5" r="1.3" fill="#34D399" />    <!-- 翠绿 (Emerald) -->
    <circle cx="18.5" cy="8.5" r="1.3" fill="#FFFFFF" fill-opacity="0.9" /> <!-- 纯白高光点 (White) -->
  </svg>
</template>
