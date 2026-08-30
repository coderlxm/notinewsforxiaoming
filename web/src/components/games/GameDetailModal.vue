<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef } from 'vue';
import type { GameItem } from './gameTypes';

const props = defineProps<{
  game: GameItem;
  ownerAuthenticated: boolean;
}>();

const emit = defineEmits<{
  close: [];
  edit: [game: GameItem];
}>();

const previewImage = shallowRef<string | null>(null);

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (previewImage.value) {
      previewImage.value = null;
    } else {
      emit('close');
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  document.body.style.overflow = 'hidden';
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="game-modal-overlay" @click.self="emit('close')">
    <div class="game-modal">
      <!-- Close Button -->
      <button
        type="button"
        class="game-modal__close-btn"
        aria-label="关闭游戏档案"
        @click="emit('close')"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        v-if="ownerAuthenticated"
        type="button"
        class="game-modal__edit-btn"
        @click="emit('edit', game)"
      >
        编辑档案
      </button>

      <!-- Modal Header Banner -->
      <div class="modal-header">
        <img
          :src="game.bannerUrl || game.coverUrl"
          :alt="game.title"
          class="modal-header__backdrop"
        />
        <div class="modal-header__gradient" />

        <div class="modal-header__content">
          <div class="modal-header__cover-wrap">
            <img :src="game.coverUrl" :alt="game.title" class="modal-header__cover" />
          </div>

          <div class="modal-header__meta">
            <div class="modal-header__tags">
              <span v-if="game.isGoty" class="tag tag--goty">★ 殿堂神作</span>
              <span v-if="game.platinumTrophy" class="tag tag--platinum">🏆 白金 100% 全成就</span>
              <span v-else-if="game.status === 'completed' || game.status === 'mastered'" class="tag tag--completed">✓ 已通关</span>
              <span v-else-if="game.status === 'playing'" class="tag tag--completed">🎮 正在游玩</span>
              <span v-else-if="game.status === 'shelved'" class="tag tag--completed">封盘</span>
              <span v-else class="tag tag--completed">待游玩</span>
              <span v-for="p in game.platforms" :key="p" class="tag tag--platform">{{ p }}</span>
            </div>

            <h2 class="modal-header__title">{{ game.title }}</h2>
            <p class="modal-header__original">{{ game.originalTitle }}</p>

            <div class="modal-header__grid-info">
              <div class="info-item">
                <span class="info-item__label">开发商</span>
                <span class="info-item__val">{{ game.developer }}</span>
              </div>
              <div class="info-item">
                <span class="info-item__label">发售年份</span>
                <span class="info-item__val">{{ game.releaseYear }}</span>
              </div>
              <div class="info-item">
                <span class="info-item__label">游玩时长</span>
                <span class="info-item__val">{{ game.playtimeHours }} 小时</span>
              </div>
              <div v-if="game.completedAt" class="info-item">
                <span class="info-item__label">通关日期</span>
                <span class="info-item__val">{{ game.completedAt }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <!-- IGN Style Verdict Box (权威评分与优缺点) -->
        <section class="verdict-box">
          <div class="verdict-box__header">
            <div class="verdict-box__score-badge">
              <span class="score-num">{{ game.rating.toFixed(1) }}</span>
              <span class="score-verdict">{{ game.verdictTitle }}</span>
            </div>
            <div class="verdict-box__quote">
              <p class="quote-text">“{{ game.punchline }}”</p>
            </div>
          </div>

          <!-- The Good & The Bad (红黑榜) -->
          <div class="pros-cons-grid">
            <div class="pros-col">
              <div class="pros-cons-title pros-cons-title--good">
                <svg viewBox="0 0 20 20" fill="currentColor" class="pros-icon">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" />
                </svg>
                <span>优点 (THE GOOD)</span>
              </div>
              <ul class="pros-cons-list">
                <li v-for="(pro, idx) in game.pros" :key="idx" class="pro-item">
                  {{ pro }}
                </li>
              </ul>
            </div>

            <div class="cons-col">
              <div class="pros-cons-title pros-cons-title--bad">
                <svg viewBox="0 0 20 20" fill="currentColor" class="cons-icon">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
                <span>缺点 (THE BAD)</span>
              </div>
              <ul class="pros-cons-list">
                <li v-for="(con, idx) in game.cons" :key="idx" class="con-item">
                  {{ con }}
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Dimension Ratings (多维维度评分) -->
        <section class="dimension-section">
          <h3 class="section-title">维度评测细分 (Dimension Breakdown)</h3>
          <div class="dimension-bars">
            <div class="dimension-bar">
              <div class="dimension-bar__info">
                <span>玩法与战斗系统 (Gameplay)</span>
                <span class="dimension-bar__val">{{ game.dimensionRatings.gameplay }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: `${(game.dimensionRatings.gameplay / 10) * 100}%` }" />
              </div>
            </div>

            <div class="dimension-bar">
              <div class="dimension-bar__info">
                <span>剧情与世界观 (Story & Lore)</span>
                <span class="dimension-bar__val">{{ game.dimensionRatings.story }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--story" :style="{ width: `${(game.dimensionRatings.story / 10) * 100}%` }" />
              </div>
            </div>

            <div class="dimension-bar">
              <div class="dimension-bar__info">
                <span>画面与艺术风格 (Visuals & Art)</span>
                <span class="dimension-bar__val">{{ game.dimensionRatings.visuals }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--visuals" :style="{ width: `${(game.dimensionRatings.visuals / 10) * 100}%` }" />
              </div>
            </div>

            <div class="dimension-bar">
              <div class="dimension-bar__info">
                <span>音乐与原声音效 (Music & Audio)</span>
                <span class="dimension-bar__val">{{ game.dimensionRatings.music }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--music" :style="{ width: `${(game.dimensionRatings.music / 10) * 100}%` }" />
              </div>
            </div>

            <div class="dimension-bar">
              <div class="dimension-bar__info">
                <span>性能与操作优化 (Performance)</span>
                <span class="dimension-bar__val">{{ game.dimensionRatings.performance }}</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill bar-fill--perf" :style="{ width: `${(game.dimensionRatings.performance / 10) * 100}%` }" />
              </div>
            </div>
          </div>
        </section>

        <!-- Personal Review Markdown (通关长评与感言) -->
        <section v-if="game.reviewMarkdown" class="review-section">
          <h3 class="section-title">通关感悟与深度长评</h3>
          <div class="review-content">
            <p
              v-for="(para, idx) in game.reviewMarkdown.split('\n\n')"
              :key="idx"
              class="review-paragraph"
            >
              {{ para }}
            </p>
          </div>
        </section>

        <!-- Screenshot Gallery (通关瞬间与高光截图) -->
        <section v-if="game.screenshots && game.screenshots.length > 0" class="screenshots-section">
          <h3 class="section-title">通关高光与回忆画廊 ({{ game.screenshots.length }})</h3>
          <div class="screenshots-grid">
            <div
              v-for="shot in game.screenshots"
              :key="shot.id"
              class="screenshot-card"
              @click="previewImage = shot.url"
            >
              <img :src="shot.url" :alt="shot.caption || '游戏截图'" class="screenshot-img" />
              <div v-if="shot.caption" class="screenshot-caption">
                {{ shot.caption }}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- Lightbox for Screenshot Preview -->
    <div
      v-if="previewImage"
      class="screenshot-lightbox"
      @click.stop="previewImage = null"
    >
      <img :src="previewImage" alt="截图大图预览" class="screenshot-lightbox__img" />
    </div>
  </div>
</template>

<style scoped>
.game-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(4, 6, 10, 0.85);
  backdrop-filter: blur(16px);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow-y: auto;
  padding: clamp(1rem, 3vw, 3rem) 1rem;
}

.game-modal {
  position: relative;
  width: min(940px, 100%);
  background: #0d1017;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08);
  margin-bottom: 2rem;
}

.game-modal__close-btn {
  position: absolute;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 10;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: all 0.2s ease;
}

.game-modal__edit-btn {
  position: absolute;
  top: 1.25rem;
  right: 4.25rem;
  z-index: 10;
  min-height: 36px;
  padding: 0 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.6);
  color: #ffffff;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
}

.game-modal__edit-btn:hover {
  border-color: rgba(59, 130, 246, 0.7);
  background: rgba(37, 99, 235, 0.75);
}

.game-modal__close-btn:hover {
  background: rgba(239, 68, 68, 0.8);
  border-color: rgba(239, 68, 68, 1);
  transform: rotate(90deg);
}

.game-modal__close-btn svg {
  width: 20px;
  height: 20px;
}

.modal-header {
  position: relative;
  min-height: 280px;
  display: flex;
  align-items: flex-end;
  padding: 2rem;
  overflow: hidden;
}

.modal-header__backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.65) contrast(1.1) blur(2px);
}

.modal-header__gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #0d1017 0%, rgba(13, 16, 23, 0.75) 50%, rgba(13, 16, 23, 0.3) 100%);
}

.modal-header__content {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 1.75rem;
  align-items: flex-end;
  width: 100%;
}

.modal-header__cover-wrap {
  width: 130px;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-header__cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.modal-header__meta {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1;
}

.modal-header__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.tag {
  padding: 0.2rem 0.55rem;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 600;
}

.tag--goty {
  background: rgba(234, 179, 8, 0.3);
  color: #fef08a;
  border: 1px solid rgba(250, 204, 21, 0.5);
}

.tag--platinum {
  background: rgba(56, 189, 248, 0.25);
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.4);
}

.tag--completed {
  background: rgba(34, 197, 94, 0.25);
  color: #bbf7d0;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.tag--platform {
  background: rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

.modal-header__title {
  margin: 0.2rem 0 0;
  font-size: clamp(1.5rem, 2.5vw, 2.2rem);
  font-weight: 800;
  color: #ffffff;
  line-height: 1.15;
}

.modal-header__original {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
}

.modal-header__grid-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-item__label {
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
}

.info-item__val {
  font-size: 0.82rem;
  font-weight: 600;
  color: #e2e8f0;
}

.modal-body {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Verdict Box */
.verdict-box {
  background: rgba(20, 25, 36, 0.7);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.verdict-box__header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.verdict-box__score-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eab308, #ca8a04);
  color: #000000;
  padding: 0.75rem 1.25rem;
  border-radius: 12px;
  min-width: 100px;
  box-shadow: 0 0 20px rgba(234, 179, 8, 0.4);
}

.score-num {
  font-size: 2.2rem;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  line-height: 1;
}

.score-verdict {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
}

.quote-text {
  margin: 0;
  font-size: 1.05rem;
  font-style: italic;
  color: #f8fafc;
  line-height: 1.5;
}

.pros-cons-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 1.25rem;
}

.pros-cons-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.pros-cons-title--good {
  color: #4ade80;
}

.pros-cons-title--bad {
  color: #f87171;
}

.pros-icon,
.cons-icon {
  width: 18px;
  height: 18px;
}

.pros-cons-list {
  margin: 0;
  padding-left: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.pro-item,
.con-item {
  font-size: 0.85rem;
  line-height: 1.45;
  color: rgba(255, 255, 255, 0.85);
}

/* Dimensions Section */
.section-title {
  margin: 0 0 1rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dimension-bars {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dimension-bar__info {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
  margin-bottom: 0.25rem;
}

.dimension-bar__val {
  font-weight: 700;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #facc15;
}

.bar-track {
  height: 6px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 3px;
  transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
}

.bar-fill--story { background: linear-gradient(90deg, #a855f7, #c084fc); }
.bar-fill--visuals { background: linear-gradient(90deg, #eab308, #fde047); }
.bar-fill--music { background: linear-gradient(90deg, #ec4899, #f472b6); }
.bar-fill--perf { background: linear-gradient(90deg, #10b981, #34d399); }

/* Review Section */
.review-paragraph {
  font-size: 0.95rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 1rem;
}

/* Screenshots Section */
.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.screenshot-card {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.screenshot-card:hover {
  transform: scale(1.03);
  border-color: #60a5fa;
}

.screenshot-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.screenshot-caption {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  padding: 0.4rem 0.6rem;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  font-size: 0.72rem;
  backdrop-filter: blur(4px);
}

/* Lightbox */
.screenshot-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  cursor: zoom-out;
}

.screenshot-lightbox__img {
  max-width: 95%;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.8);
}

@media (max-width: 640px) {
  .modal-header__content {
    flex-direction: column;
    align-items: flex-start;
  }
  .pros-cons-grid {
    grid-template-columns: 1fr;
  }
  .verdict-box__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
