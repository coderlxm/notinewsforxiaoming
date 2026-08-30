<script setup lang="ts">
import { computed } from 'vue';
import type { GameItem, GameStatsSummary } from './gameTypes';

const props = defineProps<{
  stats: GameStatsSummary;
  games: GameItem[];
}>();

const platinumRate = computed(() => {
  if (props.stats.totalCleared === 0) return '0%';
  return `${Math.round((props.stats.platinumCount / props.stats.totalCleared) * 100)}%`;
});
</script>

<template>
  <section class="stats-hud">
    <div class="stats-hud__card">
      <div class="stats-hud__icon stats-hud__icon--cleared">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <div class="stats-hud__data">
        <div class="stats-hud__value">{{ stats.totalCleared }}</div>
        <div class="stats-hud__label">已通关游戏</div>
      </div>
    </div>

    <div class="stats-hud__card">
      <div class="stats-hud__icon stats-hud__icon--platinum">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      </div>
      <div class="stats-hud__data">
        <div class="stats-hud__value">
          {{ stats.platinumCount }} <span class="stats-hud__sub">({{ platinumRate }})</span>
        </div>
        <div class="stats-hud__label">白金 / 100% 全成就</div>
      </div>
    </div>

    <div class="stats-hud__card">
      <div class="stats-hud__icon stats-hud__icon--time">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="stats-hud__data">
        <div class="stats-hud__value">{{ stats.totalHours }}<span class="stats-hud__sub">h</span></div>
        <div class="stats-hud__label">累计游玩时长</div>
      </div>
    </div>

    <div class="stats-hud__card">
      <div class="stats-hud__icon stats-hud__icon--rating">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      </div>
      <div class="stats-hud__data">
        <div class="stats-hud__value">{{ stats.averageRating.toFixed(1) }}</div>
        <div class="stats-hud__label">生涯平均评分</div>
      </div>
    </div>

    <div class="stats-hud__card stats-hud__card--platforms">
      <div class="stats-hud__platforms">
        <div class="platform-tag platform-tag--ps5">
          <span class="platform-tag__name">PS5</span>
          <span class="platform-tag__count">{{ stats.platformCounts.PS5 }}</span>
        </div>
        <div class="platform-tag platform-tag--pc">
          <span class="platform-tag__name">Steam</span>
          <span class="platform-tag__count">{{ stats.platformCounts.PC }}</span>
        </div>
        <div class="platform-tag platform-tag--switch">
          <span class="platform-tag__name">Switch</span>
          <span class="platform-tag__count">{{ stats.platformCounts.Switch }}</span>
        </div>
      </div>
      <div class="stats-hud__label stats-hud__label--right">主要阵地</div>
    </div>
  </section>
</template>

<style scoped>
.stats-hud {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: clamp(0.75rem, 1.2vw, 1.25rem);
  margin-bottom: clamp(1.5rem, 2vw, 2rem);
}

.stats-hud__card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: rgba(18, 22, 32, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 14px;
  backdrop-filter: blur(10px);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.stats-hud__card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
}

.stats-hud__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stats-hud__icon svg {
  width: 22px;
  height: 22px;
}

.stats-hud__icon--cleared {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.stats-hud__icon--platinum {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.stats-hud__icon--time {
  background: rgba(168, 85, 247, 0.12);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.stats-hud__icon--rating {
  background: rgba(234, 179, 8, 0.12);
  color: #facc15;
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.stats-hud__data {
  display: flex;
  flex-direction: column;
}

.stats-hud__value {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.stats-hud__sub {
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.5);
}

.stats-hud__label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 0.25rem;
  font-weight: 500;
}

.stats-hud__card--platforms {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.5rem;
}

.stats-hud__platforms {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.platform-tag {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.platform-tag--ps5 {
  background: rgba(0, 112, 209, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(0, 112, 209, 0.4);
}

.platform-tag--pc {
  background: rgba(23, 26, 33, 0.8);
  color: #cbd5e1;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.platform-tag--switch {
  background: rgba(230, 0, 18, 0.18);
  color: #f87171;
  border: 1px solid rgba(230, 0, 18, 0.35);
}

.platform-tag__count {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 0.8rem;
  opacity: 0.9;
}

.stats-hud__label--right {
  margin-top: 0;
}
</style>
