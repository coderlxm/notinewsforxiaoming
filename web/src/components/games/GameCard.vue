<script setup lang="ts">
import { computed } from 'vue';
import type { GameItem } from './gameTypes';

const props = defineProps<{
  game: GameItem;
}>();

const emit = defineEmits<{
  select: [game: GameItem];
}>();

const scoreThemeClass = computed(() => {
  if (props.game.rating >= 9.5) return 'score-badge--masterpiece';
  if (props.game.rating >= 9.0) return 'score-badge--amazing';
  if (props.game.rating >= 8.0) return 'score-badge--great';
  return 'score-badge--good';
});
</script>

<template>
  <article
    class="game-card"
    tabindex="0"
    role="button"
    :aria-label="`查看游戏：${game.title}`"
    @click="emit('select', game)"
    @keydown.enter="emit('select', game)"
  >
    <!-- Poster Image Frame -->
    <div class="game-card__poster">
      <img
        :src="game.coverUrl"
        :alt="game.title"
        loading="lazy"
        class="game-card__image"
      />
      <div class="game-card__overlay" />

      <!-- Top Badges -->
      <div class="game-card__top-bar">
        <div class="game-card__platforms">
          <span
            v-for="p in game.platforms"
            :key="p"
            class="platform-badge"
            :class="`platform-badge--${p.toLowerCase()}`"
          >
            {{ p }}
          </span>
        </div>

        <div class="score-badge" :class="scoreThemeClass">
          <span class="score-badge__number">{{ game.rating.toFixed(1) }}</span>
        </div>
      </div>

      <!-- Bottom Meta -->
      <div class="game-card__bottom-bar">
        <div class="game-card__status-tag">
          <span v-if="game.platinumTrophy" class="status-tag status-tag--platinum">
            🏆 白金 100%
          </span>
          <span v-else-if="game.status === 'completed' || game.status === 'mastered'" class="status-tag status-tag--completed">
            ✓ 已通关 · {{ game.playtimeHours }}h
          </span>
          <span v-else-if="game.status === 'playing'" class="status-tag status-tag--playing">
            🎮 游玩中 · {{ game.playtimeHours }}h
          </span>
          <span v-else-if="game.status === 'shelved'" class="status-tag status-tag--completed">
            封盘 · {{ game.playtimeHours }}h
          </span>
          <span v-else class="status-tag status-tag--playing">待游玩</span>
        </div>
      </div>
    </div>

    <!-- Info Info -->
    <div class="game-card__info">
      <h3 class="game-card__title" :title="game.title">
        {{ game.title }}
      </h3>
      <p class="game-card__original" :title="game.originalTitle">
        {{ game.originalTitle }}
      </p>

      <div class="game-card__footer">
        <span class="game-card__genre">{{ game.genre[0] }}</span>
        <span v-if="game.completedAt" class="game-card__date">{{ game.completedAt }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.game-card {
  display: flex;
  flex-direction: column;
  background: rgba(18, 22, 32, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  overflow: hidden;
  cursor: pointer;
  outline: none;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.3s ease,
              box-shadow 0.3s ease;
  backdrop-filter: blur(8px);
}

.game-card:hover,
.game-card:focus-visible {
  transform: translateY(-5px);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.game-card__poster {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: #0d1117;
}

.game-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.game-card:hover .game-card__image {
  transform: scale(1.06);
}

.game-card__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(13, 17, 23, 0.6) 0%,
    transparent 40%,
    rgba(13, 17, 23, 0.85) 100%
  );
  pointer-events: none;
}

.game-card__top-bar {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem;
  right: 0.6rem;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  z-index: 2;
}

.game-card__platforms {
  display: flex;
  gap: 0.25rem;
}

.platform-badge {
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.65rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.platform-badge--ps5 {
  border-color: rgba(0, 112, 209, 0.6);
  color: #93c5fd;
}

.platform-badge--pc {
  border-color: rgba(255, 255, 255, 0.3);
  color: #e2e8f0;
}

.platform-badge--switch {
  border-color: rgba(230, 0, 18, 0.6);
  color: #fca5a5;
}

.score-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  backdrop-filter: blur(8px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
}

.score-badge__number {
  font-size: 0.95rem;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}

.score-badge--masterpiece {
  background: linear-gradient(135deg, #eab308, #ca8a04);
  color: #000000;
  box-shadow: 0 0 12px rgba(234, 179, 8, 0.5);
}

.score-badge--amazing {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #ffffff;
}

.score-badge--great {
  background: linear-gradient(135deg, #10b981, #047857);
  color: #ffffff;
}

.score-badge--good {
  background: linear-gradient(135deg, #64748b, #334155);
  color: #ffffff;
}

.game-card__bottom-bar {
  position: absolute;
  bottom: 0.6rem;
  left: 0.6rem;
  right: 0.6rem;
  z-index: 2;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 600;
  backdrop-filter: blur(8px);
}

.status-tag--platinum {
  background: rgba(56, 189, 248, 0.25);
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.status-tag--completed {
  background: rgba(34, 197, 94, 0.25);
  color: #bbf7d0;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.status-tag--playing {
  background: rgba(249, 115, 22, 0.25);
  color: #fed7aa;
  border: 1px solid rgba(249, 115, 22, 0.4);
}

.game-card__info {
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.game-card__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-card__original {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.game-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.4rem;
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.4);
}

.game-card__genre {
  padding: 0.15rem 0.4rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}
</style>
