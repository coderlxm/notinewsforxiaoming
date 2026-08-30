<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `photo-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
const lensGradientId = `photo-lens-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Photographic Optics & Golden Hour Sunset Color Theme -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：天空蔚蓝 -> 极光青绿 -> 黄金日落暖阳 (自然摄影与光学透镜色彩) -->
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

      <!-- 镜头透镜内部光学多层镀膜反光 (深邃幽蓝 -> 碧青) -->
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

    <!-- 相机主体轮廓 -->
    <path
      d="M4 7C2.89543 7 2 7.89543 2 9V18C2 19.1046 2.89543 20 4 20H20C21.1046 20 22 19.1046 22 18V9C22 7.89543 21.1046 7 20 7H16.8L15.6 4.6C15.228 3.856 14.472 3.4 13.64 3.4H10.36C9.528 3.4 8.772 3.856 8.4 4.6L7.2 7H4Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 镜头外圈镂空卡口 -->
    <circle
      cx="12"
      cy="13.5"
      r="4.25"
      fill="#0c0d12"
      fill-opacity="0.88"
    />

    <!-- 镜头核心多层镀膜与光圈晶体 -->
    <circle
      cx="12"
      cy="13.5"
      r="3"
      :fill="`url(#${lensGradientId})`"
    />

    <!-- 镜头真实弧形高光点 -->
    <circle
      cx="13.2"
      cy="12.3"
      r="0.9"
      fill="#FFFFFF"
      fill-opacity="0.9"
    />

    <!-- 取景器 / 闪光指示灯 -->
    <circle
      cx="18.5"
      cy="9.8"
      r="1.2"
      fill="#FFFFFF"
      fill-opacity="0.85"
    />
  </svg>
</template>
