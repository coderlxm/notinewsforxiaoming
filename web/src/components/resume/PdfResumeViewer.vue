<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { JournalResumePreviewPage } from '../../types';

const props = defineProps<{
  pages: JournalResumePreviewPage[];
  contentUrl?: string;
  downloadUrl?: string;
  originalName?: string;
  updatedAt?: string;
}>();

const currentPage = ref(1);
const totalPages = computed(() => props.pages.length);

const activePage = computed(() =>
  props.pages.find((p) => p.pageNumber === currentPage.value) ?? props.pages[0],
);

function prevPage(): void {
  if (currentPage.value > 1) {
    currentPage.value -= 1;
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value += 1;
  }
}

function goToPage(pageNumber: number): void {
  if (pageNumber >= 1 && pageNumber <= totalPages.value) {
    currentPage.value = pageNumber;
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    prevPage();
  } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    nextPage();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="pdf-viewer-root">
    <!-- 桌面端视图：画廊级单页聚焦翻页器 -->
    <section class="pdf-book" aria-label="PDF 简历单页阅读器">
      <div class="pdf-book__stage">
        <!-- 左侧翻页浮动按钮 -->
        <button
          v-if="totalPages > 1"
          class="pdf-book__nav pdf-book__nav--prev"
          type="button"
          :disabled="currentPage <= 1"
          aria-label="上一页"
          title="上一页 (←)"
          @click="prevPage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <!-- 当前页单张精工纸张 -->
        <div v-if="activePage" class="pdf-paper">
          <div class="pdf-paper__badge">
            {{ String(activePage.pageNumber).padStart(2, '0') }} / {{ String(totalPages).padStart(2, '0') }}
          </div>

          <div class="pdf-paper__images">
            <img
              class="pdf-paper__image pdf-paper__image--light"
              :src="activePage.lightUrl"
              :width="activePage.width"
              :height="activePage.height"
              :alt="`简历第 ${activePage.pageNumber} 页，共 ${totalPages} 页`"
              fetchpriority="high"
              decoding="async"
            >
            <img
              class="pdf-paper__image pdf-paper__image--dark"
              :src="activePage.darkUrl"
              :width="activePage.width"
              :height="activePage.height"
              alt=""
              aria-hidden="true"
              decoding="async"
            >
          </div>
        </div>

        <!-- 右侧翻页浮动按钮 -->
        <button
          v-if="totalPages > 1"
          class="pdf-book__nav pdf-book__nav--next"
          type="button"
          :disabled="currentPage >= totalPages"
          aria-label="下一页"
          title="下一页 (→)"
          @click="nextPage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <!-- 底部控制与页码指示栏 -->
      <div v-if="totalPages > 1" class="pdf-book__pager">
        <button
          class="pdf-book__pager-btn"
          type="button"
          :disabled="currentPage <= 1"
          @click="prevPage"
        >
          ‹ 上一页
        </button>

        <div class="pdf-book__page-pills">
          <button
            v-for="page in pages"
            :key="page.pageNumber"
            class="pdf-book__page-pill"
            :class="{ 'pdf-book__page-pill--active': page.pageNumber === currentPage }"
            type="button"
            :aria-label="`跳转到第 ${page.pageNumber} 页`"
            @click="goToPage(page.pageNumber)"
          >
            {{ page.pageNumber }}
          </button>
        </div>

        <button
          class="pdf-book__pager-btn"
          type="button"
          :disabled="currentPage >= totalPages"
          @click="nextPage"
        >
          下一页 ›
        </button>
      </div>

      <p v-if="totalPages > 1" class="pdf-book__hint">
        支持键盘方向键 ← / → 翻页
      </p>
    </section>

    <!-- 移动端专属模式：高质感档案卡 + 全屏原生阅读/下载行动点（告别模糊微缩图） -->
    <section class="pdf-mobile-card" aria-label="移动端简历查看">
      <div class="pdf-mobile-card__header">
        <div class="pdf-mobile-card__icon-box" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div class="pdf-mobile-card__info">
          <span class="pdf-mobile-card__tag">PDF 专属文档</span>
          <h2 class="pdf-mobile-card__title">{{ originalName || '个人简历.pdf' }}</h2>
          <p class="pdf-mobile-card__sub">共 {{ totalPages }} 页 · 完整版式</p>
        </div>
      </div>

      <div class="pdf-mobile-card__actions">
        <a
          v-if="contentUrl"
          class="button button--primary pdf-mobile-card__btn"
          :href="contentUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg class="pdf-mobile-card__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          全屏原生阅读 (支持手势缩放)
        </a>

        <a
          v-if="downloadUrl"
          class="button button--quiet pdf-mobile-card__btn"
          :href="downloadUrl"
        >
          <svg class="pdf-mobile-card__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          下载 PDF 简历原件
        </a>
      </div>

      <p class="pdf-mobile-card__tip">
        手机端推荐点击全屏阅读，享受原生高清排版与平滑双指捏合缩放体验。
      </p>
    </section>
  </div>
</template>

<style scoped>
.pdf-viewer-root {
  width: 100%;
}

/* 桌面端画廊单页 */
.pdf-book {
  display: grid;
  gap: 1.25rem;
  width: 100%;
}

.pdf-book__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.pdf-paper {
  position: relative;
  width: min(100%, 860px);
  border-radius: 8px;
  background: #ffffff;
  box-shadow:
    0 16px 36px color-mix(in srgb, var(--ink) 12%, transparent),
    0 2px 6px color-mix(in srgb, var(--ink) 4%, transparent),
    0 0 0 1px var(--border-subtle);
  overflow: hidden;
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.pdf-paper__badge {
  position: absolute;
  top: 1rem;
  right: 1.1rem;
  z-index: 2;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 70%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: #ffffff;
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  opacity: 0.82;
  transition: opacity 140ms ease;
  pointer-events: none;
}

.pdf-paper:hover .pdf-paper__badge {
  opacity: 1;
}

.pdf-paper__images {
  position: relative;
  width: 100%;
}

.pdf-paper__image {
  display: block;
  width: 100%;
  height: auto;
}

.pdf-paper__image--dark {
  position: absolute;
  inset: 0;
  opacity: 0;
}

:global(html[data-theme='dark'] .pdf-paper__image--light) {
  opacity: 0;
}

:global(html[data-theme='dark'] .pdf-paper__image--dark) {
  opacity: 1;
}

/* 左右浮动翻页大箭头 */
.pdf-book__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface-card) 85%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  box-shadow: 0 8px 20px color-mix(in srgb, var(--ink) 12%, transparent);
  cursor: pointer;
  transition: transform 140ms ease, background-color 140ms ease, opacity 140ms ease, color 140ms ease;
}

.pdf-book__nav--prev {
  left: clamp(-1.25rem, -2.5vw, -1.8rem);
}

.pdf-book__nav--next {
  right: clamp(-1.25rem, -2.5vw, -1.8rem);
}

.pdf-book__nav:hover:not(:disabled) {
  background: var(--surface-card);
  color: var(--accent-strong);
  transform: translateY(-50%) scale(1.08);
}

.pdf-book__nav:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}

.pdf-book__nav svg {
  width: 1.4rem;
  height: 1.4rem;
}

/* 底部控制器 */
.pdf-book__pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

.pdf-book__pager-btn {
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
  transition: border-color 140ms ease, color 140ms ease, background-color 140ms ease;
}

.pdf-book__pager-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
  background: var(--surface-muted);
}

.pdf-book__pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.pdf-book__page-pills {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.pdf-book__page-pill {
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  background: var(--surface-card);
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 140ms ease;
}

.pdf-book__page-pill:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.pdf-book__page-pill--active {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
  color: #ffffff;
  box-shadow: 0 4px 10px color-mix(in srgb, var(--accent) 30%, transparent);
}

.pdf-book__page-pill--active:hover {
  color: #ffffff;
}

.pdf-book__hint {
  margin: -0.4rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: center;
  opacity: 0.75;
}

/* 移动端专属行动卡片 */
.pdf-mobile-card {
  display: none;
}

@media (max-width: 599px) {
  .pdf-book {
    display: none;
  }

  .pdf-mobile-card {
    display: grid;
    gap: 1.25rem;
    padding: 1.4rem;
    border-radius: var(--radius-card);
    background: var(--surface-card);
    box-shadow:
      0 10px 24px color-mix(in srgb, var(--ink) 8%, transparent),
      0 0 0 1px var(--border-subtle);
  }

  .pdf-mobile-card__header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .pdf-mobile-card__icon-box {
    display: grid;
    width: 3.2rem;
    height: 3.2rem;
    flex: none;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    place-items: center;
  }

  .pdf-mobile-card__icon-box svg {
    width: 1.7rem;
    height: 1.7rem;
  }

  .pdf-mobile-card__info {
    min-width: 0;
    display: grid;
    gap: 0.2rem;
  }

  .pdf-mobile-card__tag {
    color: var(--accent);
    font-family: var(--font-condensed);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  .pdf-mobile-card__title {
    margin: 0;
    color: var(--text-primary);
    font-size: 0.95rem;
    font-weight: 750;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pdf-mobile-card__sub {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .pdf-mobile-card__actions {
    display: grid;
    gap: 0.65rem;
  }

  .pdf-mobile-card__btn {
    width: 100%;
    min-height: 2.75rem;
    gap: 0.45rem;
    font-size: 0.82rem;
    text-decoration: none;
  }

  .pdf-mobile-card__btn-icon {
    width: 1.05rem;
    height: 1.05rem;
  }

  .pdf-mobile-card__tip {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.72rem;
    line-height: 1.5;
    text-align: center;
  }
}
</style>
