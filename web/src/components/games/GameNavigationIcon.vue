<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `game-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Cyber Gaming & Console RGB Color Theme (Switch Neon Blue/Red & PlayStation Electric Glow) -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：Switch 霓虹青蓝 -> PlayStation 电光蓝 -> 电竞玫红 (极具辨识度的主机/电竞色彩) -->
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

    <!-- 手柄机身流线型轮廓 -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M7.5 4.5C5.01472 4.5 3 6.51472 3 9C3 12.3 3.9 16.4 5.3 18.7C5.8 19.5 6.8 19.9 7.7 19.5L9.6 18.6C10.3 18.3 11.1 18.5 11.6 19.1C11.8 19.3 12.2 19.3 12.4 19.1C12.9 18.5 13.7 18.3 14.4 18.6L16.3 19.5C17.2 19.9 18.2 19.5 18.7 18.7C20.1 16.4 21 12.3 21 9C21 6.51472 18.9853 4.5 16.5 4.5H7.5Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 左侧十字方向键 (D-Pad) 哑光镂空 -->
    <path
      d="M7.5 7.5V12.5M5 10H10"
      stroke="#0c0d12"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- 右侧经典主机 ABXY 四色动作按键晶点 -->
    <circle cx="16.5" cy="8.2" r="0.9" fill="#FACC15" /> <!-- 上 (Y/黄) -->
    <circle cx="14.7" cy="10" r="0.9" fill="#38BDF8" />  <!-- 左 (X/蓝) -->
    <circle cx="18.3" cy="10" r="0.9" fill="#FF4757" />  <!-- 右 (B/红) -->
    <circle cx="16.5" cy="11.8" r="0.9" fill="#2ED573" /> <!-- 下 (A/绿) -->

    <!-- 顶部中央 Home / 联机微光指示灯 -->
    <circle cx="12" cy="7.5" r="0.9" fill="#FFFFFF" fill-opacity="0.85" />
  </svg>
</template>
