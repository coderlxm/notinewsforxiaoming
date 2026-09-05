<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `about-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- Personal Profile, Bio & Growth Color Theme -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <!-- 主渐变：生机薄荷绿 -> 翡翠绿 -> 碧青 -> 蔚蓝 (个人身份与成长色彩) -->
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

    <!-- 头部肖像 -->
    <circle
      cx="12"
      cy="7.5"
      r="3.8"
      :fill="`url(#${gradientId})`"
    />

    <!-- 身体与肩膀轮廓 -->
    <path
      d="M4.5 19.5C4.5 15.634 7.85786 13.25 12 13.25C16.1421 13.25 19.5 15.634 19.5 19.5C19.5 20.3284 18.8284 21 18 21H6C5.17157 21 4.5 20.3284 4.5 19.5Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 头部柔和高光弧点 -->
    <circle
      cx="13.2"
      cy="6.3"
      r="1.1"
      fill="#FFFFFF"
      fill-opacity="0.9"
    />

    <!-- 衣领/胸前身份标识线条 -->
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
