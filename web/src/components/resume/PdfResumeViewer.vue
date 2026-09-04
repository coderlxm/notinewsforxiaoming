<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import type { JournalResumePreviewPage, SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';
import AboutContactIcon from '../about/AboutContactIcon.vue';

const props = defineProps<{
  pages: JournalResumePreviewPage[];
  contentUrl?: string;
  downloadUrl?: string;
  originalName?: string;
  updatedAt?: string;
  shareUrl?: string | null;
  contacts?: SiteContactItem[];
}>();

type PageDirection = 'next' | 'prev';

const currentPage = shallowRef(1);
const navigating = shallowRef(false);
const pageDirection = shallowRef<PageDirection>('next');
const previewImages = new Map<string, HTMLImageElement>();
const totalPages = computed(() => props.pages.length);

const activePage = computed(() =>
  props.pages.find((p) => p.pageNumber === currentPage.value) ?? props.pages[0],
);

const pageTransitionName = computed(() => `pdf-page-${pageDirection.value}`);

const visibleContacts = computed(() =>
  props.contacts?.filter((item) => item.enabled && item.value.trim()) ?? [],
);

const formattedDate = computed(() => {
  if (!props.updatedAt) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(props.updatedAt));
});

function preloadPreviewImages(): void {
  for (const page of props.pages) {
    for (const source of [page.lightUrl, page.darkUrl]) {
      const image = new Image();
      image.src = source;
      previewImages.set(source, image);
    }
  }
}

async function ensurePageDecoded(page: JournalResumePreviewPage): Promise<void> {
  await Promise.all([
    previewImages.get(page.lightUrl)!.decode(),
    previewImages.get(page.darkUrl)!.decode(),
  ]);
}

async function goToPage(pageNumber: number): Promise<void> {
  if (
    navigating.value
    || pageNumber === currentPage.value
    || pageNumber < 1
    || pageNumber > totalPages.value
  ) return;

  const targetPage = props.pages.find(item => item.pageNumber === pageNumber);
  if (!targetPage) return;

  navigating.value = true;

  try {
    await ensurePageDecoded(targetPage);
    pageDirection.value = pageNumber > currentPage.value ? 'next' : 'prev';
    currentPage.value = pageNumber;
  } catch (error) {
    navigating.value = false;
    throw error;
  }
}

function finishPageTurn(): void {
  navigating.value = false;
}

function prevPage(): void {
  void goToPage(currentPage.value - 1);
}

function nextPage(): void {
  void goToPage(currentPage.value + 1);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
    prevPage();
  } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
    nextPage();
  }
}

function contactHref(item: SiteContactItem): string | undefined {
  if (item.kind === 'email') return `mailto:${item.value}`;
  if (item.url) return item.url;
  return undefined;
}

async function copyContact(item: SiteContactItem): Promise<void> {
  await navigator.clipboard.writeText(item.value);
  showMessage({ message: `已复制${item.label}`, type: 'success' });
}

async function copyShareUrl(): Promise<void> {
  if (!props.shareUrl) return;
  await navigator.clipboard.writeText(props.shareUrl);
  showMessage({ message: '简历分享地址已复制', type: 'success' });
}

onMounted(() => {
  preloadPreviewImages();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  previewImages.clear();
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="pdf-viewer-root">
    <!-- 桌面端视图：单页纸张翻页器 -->
    <section class="pdf-book" aria-label="PDF 简历单页阅读器">
      <div class="pdf-book__stage" :aria-busy="navigating">
        <!-- 左侧翻页浮动按钮 -->
        <button
          v-if="totalPages > 1"
          class="pdf-book__nav pdf-book__nav--prev"
          type="button"
          :disabled="navigating || currentPage <= 1"
          aria-label="上一页"
          title="上一页 (←)"
          @click="prevPage"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <!-- 单页纸张舞台 -->
        <div class="pdf-book__viewport">
          <Transition :name="pageTransitionName" @after-enter="finishPageTurn">
            <div
              v-if="activePage"
              :key="activePage.pageNumber"
              class="pdf-paper"
            >
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

              <div class="pdf-paper__turn-shadow" aria-hidden="true" />
              <div class="pdf-paper__spine-shadow" aria-hidden="true" />
            </div>
          </Transition>
        </div>

        <!-- 右侧翻页浮动按钮 -->
        <button
          v-if="totalPages > 1"
          class="pdf-book__nav pdf-book__nav--next"
          type="button"
          :disabled="navigating || currentPage >= totalPages"
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
          :disabled="navigating || currentPage <= 1"
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
            :disabled="navigating"
            @click="goToPage(page.pageNumber)"
          >
            {{ page.pageNumber }}
          </button>
        </div>

        <button
          class="pdf-book__pager-btn"
          type="button"
          :disabled="navigating || currentPage >= totalPages"
          @click="nextPage"
        >
          下一页 ›
        </button>
      </div>

      <p v-if="totalPages > 1" class="pdf-book__hint">
        支持键盘方向键 ← / → 翻页
      </p>
    </section>

    <!-- 移动端专属模式：一体化集约个人档案卡（0 重复、极简高效） -->
    <section class="pdf-mobile-card" aria-label="移动端简历查看">
      <div class="pdf-mobile-card__header">
        <div class="pdf-mobile-card__header-top">
          <span class="pdf-mobile-card__badge">PDF · 共 {{ totalPages }} 页</span>
          <span v-if="formattedDate" class="pdf-mobile-card__date">更新于 {{ formattedDate }}</span>
        </div>
        <h1 class="pdf-mobile-card__title">{{ originalName || '个人简历.pdf' }}</h1>
      </div>

      <!-- 联系方式药丸群 -->
      <div v-if="visibleContacts.length" class="pdf-mobile-card__contacts">
        <template v-for="item in visibleContacts" :key="item.kind">
          <button
            v-if="item.kind === 'wechat' || !contactHref(item)"
            class="pdf-mobile-card__pill"
            type="button"
            :title="`点击复制 ${item.label}: ${item.value}`"
            @click="copyContact(item)"
          >
            <AboutContactIcon class="pdf-mobile-card__pill-icon" :kind="item.kind" />
            <span class="pdf-mobile-card__pill-label">{{ item.label }}:</span>
            <span class="pdf-mobile-card__pill-value">{{ item.value }}</span>
          </button>
          <a
            v-else
            class="pdf-mobile-card__pill"
            :href="contactHref(item)"
            :target="item.kind === 'email' ? undefined : '_blank'"
            :rel="item.kind === 'email' ? undefined : 'noopener noreferrer'"
            :title="`${item.label}: ${item.value}`"
          >
            <AboutContactIcon class="pdf-mobile-card__pill-icon" :kind="item.kind" />
            <span class="pdf-mobile-card__pill-label">{{ item.label }}:</span>
            <span class="pdf-mobile-card__pill-value">{{ item.value }}</span>
            <span v-if="item.kind !== 'email'" class="pdf-mobile-card__pill-arrow" aria-hidden="true">↗</span>
          </a>
        </template>
      </div>

      <div class="pdf-mobile-card__divider" aria-hidden="true" />

      <!-- 主行动按钮 -->
      <div class="pdf-mobile-card__actions">
        <a
          v-if="contentUrl"
          class="button button--primary pdf-mobile-card__btn-main"
          :href="contentUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg class="pdf-mobile-card__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          在新窗口全屏阅读 (支持手势缩放)
        </a>

        <div class="pdf-mobile-card__btn-row">
          <a
            v-if="downloadUrl"
            class="button button--quiet pdf-mobile-card__btn-sub"
            :href="downloadUrl"
          >
            <svg class="pdf-mobile-card__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            下载原件
          </a>

          <button
            v-if="shareUrl"
            class="button button--quiet pdf-mobile-card__btn-sub"
            type="button"
            @click="copyShareUrl"
          >
            <svg class="pdf-mobile-card__btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            复制地址
          </button>
        </div>
      </div>

      <!-- 底部返回链接 -->
      <div class="pdf-mobile-card__footer">
        <RouterLink class="text-button pdf-mobile-card__back" to="/about">
          ← 返回关于我
        </RouterLink>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pdf-viewer-root {
  width: 100%;
}

/* 桌面端画廊 */
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

/* 页面始终叠在同一舞台，切换时由 Vue 同时保留新旧两页。 */
.pdf-book__viewport {
  position: relative;
  display: grid;
  width: min(100%, 860px);
  perspective: 1800px;
  perspective-origin: center center;
  isolation: isolate;
}

.pdf-paper {
  position: relative;
  grid-area: 1 / 1;
  width: 100%;
  border-radius: 8px;
  background: var(--surface-card);
  box-shadow:
    0 2px 5px color-mix(in srgb, var(--ink) 4%, transparent),
    0 12px 28px color-mix(in srgb, var(--ink) 10%, transparent),
    0 24px 48px color-mix(in srgb, var(--ink) 6%, transparent),
    0 0 0 1px var(--border-subtle);
  overflow: hidden;
  user-select: none;
  backface-visibility: hidden;
  transform-origin: left center;
}

.pdf-paper__badge {
  position: absolute;
  top: 1rem;
  right: 1.1rem;
  z-index: 5;
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

/* 左侧保持轻微装订压痕，右侧光影只在翻动期间出现。 */
.pdf-paper__spine-shadow {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 20px;
  background: linear-gradient(
    to right,
    color-mix(in srgb, var(--ink) 11%, transparent) 0%,
    color-mix(in srgb, var(--ink) 4%, transparent) 42%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 4;
}

.pdf-paper__turn-shadow {
  position: absolute;
  inset: 0;
  z-index: 4;
  background: linear-gradient(
    to left,
    color-mix(in srgb, var(--ink) 28%, transparent) 0%,
    color-mix(in srgb, var(--ink) 9%, transparent) 8%,
    transparent 24%
  );
  opacity: 0;
  pointer-events: none;
}

/* 前进：当前页轻抬后退场，下一页在下层显露。 */
.pdf-page-next-enter-active,
.pdf-page-next-leave-active,
.pdf-page-prev-enter-active,
.pdf-page-prev-leave-active {
  will-change: transform, opacity;
}

.pdf-page-next-enter-active,
.pdf-page-prev-leave-active {
  z-index: 1;
  transition:
    transform 430ms cubic-bezier(0.22, 0.68, 0.2, 1),
    opacity 300ms ease;
}

.pdf-page-next-leave-active,
.pdf-page-prev-enter-active {
  z-index: 2;
  transition:
    transform 430ms cubic-bezier(0.22, 0.68, 0.2, 1),
    opacity 260ms ease 70ms;
}

.pdf-page-next-enter-from,
.pdf-page-prev-leave-to {
  opacity: 0.82;
  transform: translate3d(1.25%, 0, -18px) scale(0.994);
}

.pdf-page-next-leave-to,
.pdf-page-prev-enter-from {
  opacity: 0;
  transform: translate3d(-4.5%, 0, 24px) rotateY(-9deg) scale(0.992);
}

.pdf-page-next-leave-active .pdf-paper__turn-shadow,
.pdf-page-prev-enter-active .pdf-paper__turn-shadow {
  transition: opacity 430ms cubic-bezier(0.22, 0.68, 0.2, 1);
}

.pdf-page-next-leave-to .pdf-paper__turn-shadow,
.pdf-page-prev-enter-from .pdf-paper__turn-shadow {
  opacity: 0.9;
}

/* 左右浮动翻页大箭头 */
.pdf-book__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
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

/* 移动端专属一体化档案卡 */
.pdf-mobile-card {
  display: none;
}

@media (max-width: 599px) {
  .pdf-book {
    display: none;
  }

  .pdf-mobile-card {
    display: grid;
    gap: 1.15rem;
    margin-top: 0.25rem;
    padding: 1.4rem;
    border-radius: var(--radius-card);
    background: var(--surface-card);
    box-shadow:
      0 10px 24px color-mix(in srgb, var(--ink) 8%, transparent),
      0 0 0 1px var(--border-subtle);
  }

  .pdf-mobile-card__header {
    display: grid;
    gap: 0.4rem;
  }

  .pdf-mobile-card__header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .pdf-mobile-card__badge {
    padding: 0.12rem 0.45rem;
    border-radius: 4px;
    background: var(--accent-soft);
    color: var(--accent-strong);
    font-family: var(--font-condensed);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.05em;
  }

  .pdf-mobile-card__date {
    color: var(--text-muted);
    font-size: 0.72rem;
  }

  .pdf-mobile-card__title {
    margin: 0.2rem 0 0;
    color: var(--text-primary);
    font-family: var(--font-serif);
    font-size: 1.15rem;
    font-weight: 750;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .pdf-mobile-card__contacts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .pdf-mobile-card__pill {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.6rem;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    background: var(--surface-page);
    color: var(--text-primary);
    font-size: 0.72rem;
    text-decoration: none;
    cursor: pointer;
  }

  .pdf-mobile-card__pill-icon {
    width: 0.9rem;
    height: 0.9rem;
    flex: none;
    color: var(--accent-strong);
  }

  .pdf-mobile-card__pill-label {
    color: var(--text-muted);
    font-size: 0.68rem;
    font-weight: 600;
  }

  .pdf-mobile-card__pill-value {
    font-weight: 600;
    max-width: 11rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pdf-mobile-card__pill-arrow {
    color: var(--text-muted);
    font-size: 0.66rem;
  }

  .pdf-mobile-card__divider {
    height: 1px;
    background: var(--border-subtle);
  }

  .pdf-mobile-card__actions {
    display: grid;
    gap: 0.6rem;
  }

  .pdf-mobile-card__btn-main {
    display: flex;
    width: 100%;
    min-height: 2.85rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
  }

  .pdf-mobile-card__btn-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .pdf-mobile-card__btn-sub {
    display: flex;
    width: 100%;
    min-height: 2.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    text-decoration: none;
  }

  .pdf-mobile-card__btn-icon {
    width: 1rem;
    height: 1rem;
    flex: none;
  }

  .pdf-mobile-card__footer {
    display: flex;
    justify-content: center;
    padding-top: 0.25rem;
  }

  .pdf-mobile-card__back {
    color: var(--text-muted);
    font-size: 0.75rem;
  }
}
</style>
