<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import type { GameItem } from './gameTypes';

const props = defineProps<{
  games: GameItem[];
}>();

const emit = defineEmits<{
  selectGame: [game: GameItem];
}>();

const activeIndex = ref(0);
let timer: ReturnType<typeof setInterval> | null = null;
const SLIDE_DURATION = 6000;

const featuredGames = computed(() => {
  const gotyGames = props.games.filter(g => g.isGoty);
  return gotyGames.length > 0 ? gotyGames : props.games.slice(0, 3);
});

const activeGame = computed<GameItem | null>(() => {
  if (featuredGames.value.length === 0) return null;
  return featuredGames.value[activeIndex.value] ?? featuredGames.value[0];
});

function nextSlide(): void {
  if (featuredGames.value.length <= 1) return;
  activeIndex.value = (activeIndex.value + 1) % featuredGames.value.length;
}

function prevSlide(): void {
  if (featuredGames.value.length <= 1) return;
  activeIndex.value = (activeIndex.value - 1 + featuredGames.value.length) % featuredGames.value.length;
}

function goToSlide(index: number): void {
  activeIndex.value = index;
  resetTimer();
}

function startTimer(): void {
  stopTimer();
  if (featuredGames.value.length <= 1) return;
  timer = setInterval(nextSlide, SLIDE_DURATION);
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function resetTimer(): void {
  stopTimer();
  startTimer();
}

onMounted(startTimer);
onBeforeUnmount(stopTimer);
</script>

<template>
  <section
    v-if="activeGame"
    class="game-hero"
    @mouseenter="stopTimer"
    @mouseleave="startTimer"
  >
    <!-- Background Banner with Multi-layered Overlay -->
    <div class="game-hero__backdrop">
      <img
        :key="activeGame.id"
        :src="activeGame.bannerUrl || activeGame.coverUrl"
        :alt="activeGame.title"
        class="game-hero__image"
      />
      <div class="game-hero__gradient game-hero__gradient--bottom" />
      <div class="game-hero__gradient game-hero__gradient--left" />
      <div class="game-hero__gradient game-hero__gradient--radial" />
    </div>

    <!-- Content Area -->
    <div class="game-hero__content">
      <!-- Badges Row -->
      <div class="game-hero__badges">
        <span v-if="activeGame.isGoty" class="badge badge--goty">
          ★ 殿堂神作
        </span>
        <span v-if="activeGame.platinumTrophy" class="badge badge--platinum">
          🏆 白金 100%
        </span>
        <span v-else-if="activeGame.status === 'completed' || activeGame.status === 'mastered'" class="badge badge--completed">
          ✓ 已通关 · {{ activeGame.playtimeHours }}h
        </span>
        <span v-else-if="activeGame.status === 'playing'" class="badge badge--completed">
          🎮 游玩中 · {{ activeGame.playtimeHours }}h
        </span>
        <span v-else-if="activeGame.status === 'shelved'" class="badge badge--completed">
          封盘 · {{ activeGame.playtimeHours }}h
        </span>
        <span v-else class="badge badge--completed">待游玩</span>
        <span
          v-for="platform in activeGame.platforms"
          :key="platform"
          class="badge badge--platform"
        >
          {{ platform }}
        </span>
      </div>

      <!-- Title & Subtitle -->
      <h1 class="game-hero__title">
        {{ activeGame.title }}
      </h1>
      <p v-if="activeGame.originalTitle" class="game-hero__subtitle">
        {{ activeGame.originalTitle }} · {{ activeGame.developer }} ({{ activeGame.releaseYear }})
      </p>

      <!-- Punchline / Verdict -->
      <p class="game-hero__punchline">
        “{{ activeGame.punchline }}”
      </p>

      <!-- Action & Score Row -->
      <div class="game-hero__action-bar">
        <div class="game-hero__score-badge" @click="emit('selectGame', activeGame)">
          <span class="game-hero__score-number">{{ activeGame.rating.toFixed(1) }}</span>
          <div class="game-hero__score-meta">
            <span class="game-hero__score-verdict">{{ activeGame.verdictTitle }}</span>
            <span class="game-hero__score-label">个人权威评分</span>
          </div>
        </div>

        <button
          type="button"
          class="game-hero__inspect-btn"
          @click="emit('selectGame', activeGame)"
        >
          <span>查看通关评测与成就档案</span>
          <svg viewBox="0 0 20 20" fill="currentColor" class="icon-arrow">
            <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Navigation Dots & Arrows -->
    <div v-if="featuredGames.length > 1" class="game-hero__controls">
      <div class="game-hero__dots">
        <button
          v-for="(game, idx) in featuredGames"
          :key="game.id"
          type="button"
          class="game-hero__dot"
          :class="{ 'game-hero__dot--active': idx === activeIndex }"
          :aria-label="`切换至 ${game.title}`"
          @click="goToSlide(idx)"
        />
      </div>

      <div class="game-hero__arrows">
        <button
          type="button"
          class="game-hero__arrow"
          aria-label="上一款精选游戏"
          @click="prevSlide"
        >
          ‹
        </button>
        <button
          type="button"
          class="game-hero__arrow"
          aria-label="下一款精选游戏"
          @click="nextSlide"
        >
          ›
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.game-hero {
  position: relative;
  width: 100%;
  min-height: clamp(380px, 56vh, 560px);
  display: flex;
  align-items: flex-end;
  border-radius: 0;
  overflow: hidden;
  margin-bottom: clamp(1.5rem, 2.5vw, 2.5rem);
  background: #090a0f;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.game-hero__backdrop {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.game-hero__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
  filter: brightness(0.85) contrast(1.08);
  transition: transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease;
}

.game-hero:hover .game-hero__image {
  transform: scale(1.03);
}

.game-hero__gradient {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.game-hero__gradient--bottom {
  background: linear-gradient(
    to top,
    #090a0f 0%,
    rgba(9, 10, 15, 0.92) 28%,
    rgba(9, 10, 15, 0.35) 65%,
    transparent 100%
  );
}

.game-hero__gradient--left {
  background: linear-gradient(
    to right,
    rgba(9, 10, 15, 0.95) 0%,
    rgba(9, 10, 15, 0.7) 40%,
    transparent 100%
  );
}

.game-hero__gradient--radial {
  background: radial-gradient(
    circle at 20% 80%,
    rgba(9, 10, 15, 0.8) 0%,
    transparent 60%
  );
}

.game-hero__content {
  position: relative;
  z-index: 2;
  padding: clamp(1.5rem, 3vw, 3rem) clamp(1rem, 2.5vw, 3rem);
  max-width: min(900px, 90%);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.game-hero__badges {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  max-width: 100%;
  overflow-x: auto;
  flex-wrap: nowrap;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.game-hero__badges::-webkit-scrollbar {
  display: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0.22rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  flex-shrink: 0;
  backdrop-filter: blur(12px);
}

.badge--goty {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.4));
  color: #fef08a;
  border: 1px solid rgba(250, 204, 21, 0.5);
  box-shadow: 0 0 16px rgba(234, 179, 8, 0.25);
}

.badge--platinum {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(14, 165, 233, 0.35));
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.badge--completed {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge--platform {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.game-hero__title {
  margin: 0;
  font-size: clamp(1.75rem, 3.5vw, 2.75rem);
  font-weight: 800;
  line-height: 1.15;
  color: #ffffff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
  letter-spacing: -0.01em;
}

.game-hero__subtitle {
  margin: 0;
  font-size: clamp(0.85rem, 1.2vw, 0.95rem);
  color: rgba(255, 255, 255, 0.65);
  font-weight: 500;
}

.game-hero__punchline {
  margin: 0.25rem 0 0.5rem;
  font-size: clamp(0.95rem, 1.3vw, 1.1rem);
  color: rgba(255, 255, 255, 0.92);
  line-height: 1.5;
  font-style: italic;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.7);
}

.game-hero__action-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-top: 0.5rem;
}

.game-hero__score-badge {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.85rem;
  background: rgba(16, 20, 29, 0.85);
  border: 1px solid rgba(234, 179, 8, 0.4);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.game-hero__score-badge:hover {
  transform: translateY(-2px);
  border-color: rgba(250, 204, 21, 0.8);
}

.game-hero__score-number {
  font-size: 1.75rem;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #facc15;
  line-height: 1;
}

.game-hero__score-meta {
  display: flex;
  flex-direction: column;
}

.game-hero__score-verdict {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #ffffff;
}

.game-hero__score-label {
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.5);
}

.game-hero__inspect-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.25rem;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.game-hero__inspect-btn:hover {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.5);
}

.icon-arrow {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

.game-hero__inspect-btn:hover .icon-arrow {
  transform: translateX(3px);
}

.game-hero__controls {
  position: absolute;
  right: clamp(1rem, 2.5vw, 3rem);
  bottom: clamp(1.5rem, 3vw, 3rem);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.game-hero__dots {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.game-hero__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.game-hero__dot--active {
  width: 24px;
  border-radius: 4px;
  background: #facc15;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.6);
}

.game-hero__arrows {
  display: flex;
  gap: 0.35rem;
}

.game-hero__arrow {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(20, 24, 34, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 1.2rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.game-hero__arrow:hover {
  background: rgba(37, 99, 235, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
}

@media (max-width: 640px) {
  .game-hero {
    min-height: 380px;
  }
  .game-hero__content {
    max-width: 100%;
  }
  .game-hero__controls {
    display: none;
  }
}
</style>
