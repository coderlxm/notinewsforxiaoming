<script setup lang="ts">
import { useId } from 'vue';

const rawId = useId();
const gradientId = `guestbook-nav-grad-${rawId.replace(/[^a-zA-Z0-9-_]/g, '')}`;
</script>

<template>
  <!-- 对话气泡 + 留言横线，琥珀-玫红-紫渐变 -->
  <svg
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        :id="gradientId"
        x1="3"
        y1="4"
        x2="21"
        y2="21"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0%" stop-color="#F59E0B" />
        <stop offset="52%" stop-color="#F472B6" />
        <stop offset="100%" stop-color="#A855F7" />
      </linearGradient>
    </defs>

    <!-- 气泡机身（左下角带纸条式折尾） -->
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M5.5 3h13A2.5 2.5 0 0 1 21 5.5v10a2.5 2.5 0 0 1-2.5 2.5H7.4L4 21V5.5A2.5 2.5 0 0 1 5.5 3Z"
      :fill="`url(#${gradientId})`"
    />

    <!-- 留言横线 -->
    <path
      d="M8 8.2h8M8 11.8h5.2"
      stroke="#0c0d12"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
