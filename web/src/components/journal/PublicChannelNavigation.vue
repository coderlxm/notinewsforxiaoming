<script setup lang="ts">
import { onClickOutside, useMediaQuery } from '@vueuse/core';
import { computed, onUnmounted, shallowRef, useTemplateRef } from 'vue';
import { useNavIconStyle } from '../../composables/useNavIconStyle';
import type { JournalChannel } from '../../types';
import AboutNavigationIcon from '../about/AboutNavigationIcon.vue';
import AINavigationIcon from '../ai/AINavigationIcon.vue';
import GameNavigationIcon from '../games/GameNavigationIcon.vue';
import GuestbookNavigationIcon from '../guestbook/GuestbookNavigationIcon.vue';
import PhotoNavigationIcon from '../photos/PhotoNavigationIcon.vue';
import ArticleNavigationIcon from './ArticleNavigationIcon.vue';
import InterestNavigationIcon from './InterestNavigationIcon.vue';
import LifeNavigationIcon from './LifeNavigationIcon.vue';

const { navIconStyle, toggleNavIconStyle } = useNavIconStyle();
// 图标风格切换入口展示控制（保持萌系线条为默认风格，切换组件隐藏但保留代码）
const showStyleToggle = false;

const props = withDefaults(
  defineProps<{
    channel: JournalChannel | null;
    aboutActive: boolean;
    photosActive: boolean;
    gamesActive?: boolean;
    guestbookActive?: boolean;
    immersive: boolean;
    aiActive?: boolean;
  }>(),
  {
    gamesActive: false,
    guestbookActive: false,
    aiActive: false,
  },
);

const emit = defineEmits<{
  select: [channel: JournalChannel];
  selectAbout: [];
  selectPhotos: [];
  selectGames: [];
  selectGuestbook: [];
  selectAi: [];
}>();

const sidebar = useTemplateRef<HTMLElement>('sidebar');
const edgeTrigger = useTemplateRef<HTMLButtonElement>('edgeTrigger');
const desktopNavigation = useMediaQuery('(min-width: 800px)');
const immersiveDrawer = computed(() => props.immersive && desktopNavigation.value);
const drawerOpen = shallowRef(false);
const moreOpen = shallowRef(false);
const aiNoticeVisible = shallowRef(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const isMoreActive = computed(() =>
  props.photosActive || props.gamesActive || props.guestbookActive || props.aboutActive || props.aiActive,
);

function toggleMore(): void {
  moreOpen.value = !moreOpen.value;
}

function closeMore(): void {
  moreOpen.value = false;
}

function openDrawer(): void {
  if (immersiveDrawer.value) drawerOpen.value = true;
}

function closeDrawer(): void {
  drawerOpen.value = false;
  closeMore();
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && sidebar.value?.contains(nextTarget)) return;
  closeDrawer();
}

function handlePointerLeave(event: PointerEvent): void {
  if (event.pointerType !== 'mouse') return;
  const activeElement = document.activeElement;
  if (activeElement instanceof Node && sidebar.value?.contains(activeElement)) return;
  closeDrawer();
}

function handleEscape(): void {
  if (moreOpen.value) {
    closeMore();
    return;
  }
  if (!immersiveDrawer.value || !drawerOpen.value) return;
  closeDrawer();
  edgeTrigger.value?.focus();
}

function selectChannel(channel: JournalChannel): void {
  closeDrawer();
  closeMore();
  emit('select', channel);
}

function selectPhotos(): void {
  closeDrawer();
  closeMore();
  emit('selectPhotos');
}

function selectGames(): void {
  closeDrawer();
  closeMore();
  emit('selectGames');
}

function selectGuestbook(): void {
  closeDrawer();
  closeMore();
  emit('selectGuestbook');
}

function selectAi(): void {
  closeDrawer();
  closeMore();
  emit('selectAi');
  aiNoticeVisible.value = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    aiNoticeVisible.value = false;
    toastTimer = null;
  }, 2200);
}

function selectAbout(): void {
  closeDrawer();
  closeMore();
  emit('selectAbout');
}

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer);
});

onClickOutside(sidebar, () => {
  closeDrawer();
  closeMore();
});
</script>

<template>
  <aside
    ref="sidebar"
    class="channel-sidebar"
    :class="{
      'channel-sidebar--immersive': immersive,
      'channel-sidebar--open': immersive && drawerOpen,
    }"
    @pointerleave="handlePointerLeave"
    @focusout="handleFocusOut"
    @keydown.esc.stop.prevent="handleEscape"
  >
    <button
      v-if="immersiveDrawer"
      ref="edgeTrigger"
      class="channel-sidebar__edge-trigger"
      type="button"
      aria-label="展开页面导航"
      aria-controls="public-channel-navigation"
      :aria-expanded="drawerOpen"
      @pointerenter="openDrawer"
      @focus="openDrawer"
      @click="openDrawer"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m8 5 7 7-7 7" />
        <path d="m13 5 7 7-7 7" />
      </svg>
    </button>

    <div
      class="channel-sidebar__panel"
      :aria-hidden="immersiveDrawer && !drawerOpen ? 'true' : undefined"
      @pointerenter="openDrawer"
    >
      <nav id="public-channel-navigation" class="channel-sidebar__navigation" aria-label="公开页面导航">
        <div class="channel-sidebar__channels">
          <!-- 基础频道 (生活、文章、兴趣) -->
          <button
            class="channel-sidebar__item channel-sidebar__life"
            :class="{ 'channel-sidebar__item--active': channel === 'life' && !isMoreActive }"
            type="button"
            :aria-current="channel === 'life' && !isMoreActive ? 'page' : undefined"
            @click="selectChannel('life')"
          >
            <LifeNavigationIcon class="channel-sidebar__life-icon" />
            <span>生活</span>
          </button>

          <button
            class="channel-sidebar__item channel-sidebar__article"
            :class="{ 'channel-sidebar__item--active': channel === 'article' && !isMoreActive }"
            type="button"
            :aria-current="channel === 'article' && !isMoreActive ? 'page' : undefined"
            @click="selectChannel('article')"
          >
            <ArticleNavigationIcon class="channel-sidebar__article-icon" />
            <span>文章</span>
          </button>

          <button
            class="channel-sidebar__item channel-sidebar__interest"
            :class="{ 'channel-sidebar__item--active': channel === 'interest' && !isMoreActive }"
            type="button"
            :aria-current="channel === 'interest' && !isMoreActive ? 'page' : undefined"
            @click="selectChannel('interest')"
          >
            <InterestNavigationIcon class="channel-sidebar__interest-icon" />
            <span>兴趣</span>
          </button>

          <!-- 桌面端专属频道项 (照片墙、游戏墙) -->
          <button
            class="channel-sidebar__item channel-sidebar__item--desktop channel-sidebar__photo"
            :class="{ 'channel-sidebar__item--active': photosActive }"
            type="button"
            :aria-current="photosActive ? 'page' : undefined"
            @click="selectPhotos"
          >
            <PhotoNavigationIcon class="channel-sidebar__photo-icon" />
            <span>照片墙</span>
          </button>

          <button
            class="channel-sidebar__item channel-sidebar__item--desktop channel-sidebar__game"
            :class="{ 'channel-sidebar__item--active': gamesActive }"
            type="button"
            :aria-current="gamesActive ? 'page' : undefined"
            @click="selectGames"
          >
            <GameNavigationIcon class="channel-sidebar__game-icon" />
            <span>游戏墙</span>
          </button>

          <button
            class="channel-sidebar__item channel-sidebar__item--desktop channel-sidebar__guestbook"
            :class="{ 'channel-sidebar__item--active': guestbookActive }"
            type="button"
            :aria-current="guestbookActive ? 'page' : undefined"
            @click="selectGuestbook"
          >
            <GuestbookNavigationIcon class="channel-sidebar__guestbook-icon" />
            <span>留言板</span>
          </button>

          <!-- 移动端专属 “更多” 聚合入口 (点击弹出照片墙/游戏墙/AI/关于我) -->
          <button
            class="channel-sidebar__item channel-sidebar__item--mobile-more"
            :class="{
              'channel-sidebar__item--active': isMoreActive,
              'channel-sidebar__item--more-open': moreOpen,
            }"
            type="button"
            :aria-expanded="moreOpen"
            aria-haspopup="true"
            aria-label="展开更多模块"
            @click.stop="toggleMore"
          >
            <span>更多</span>
          </button>
        </div>

        <!-- 桌面端专属底部项 (AI、关于我、风格切换) -->
        <div class="channel-sidebar__footer channel-sidebar__footer--desktop">
          <button
            class="channel-sidebar__item channel-sidebar__item--ai"
            :class="{ 'channel-sidebar__item--active': aiActive }"
            type="button"
            :aria-current="aiActive ? 'page' : undefined"
            @click="selectAi"
          >
            <AINavigationIcon class="channel-sidebar__ai-icon" />
            <span>AI</span>
          </button>
          <button
            class="channel-sidebar__item channel-sidebar__about"
            :class="{ 'channel-sidebar__item--active': aboutActive }"
            type="button"
            :aria-current="aboutActive ? 'page' : undefined"
            @click="selectAbout"
          >
            <AboutNavigationIcon class="channel-sidebar__about-icon" />
            <span>关于我</span>
          </button>

          <!-- 图标风格切换开关（默认隐藏，代码保留供随时启用） -->
          <button
            v-if="showStyleToggle"
            class="channel-sidebar__style-toggle"
            type="button"
            :title="navIconStyle === 'playful-line' ? '当前：萌系线条风格，点击切换为质感渐变' : '当前：质感渐变风格，点击切换为萌系线条'"
            aria-label="切换侧栏图标风格"
            @click="toggleNavIconStyle"
          >
            <span class="channel-sidebar__style-badge">
              <svg v-if="navIconStyle === 'playful-line'" class="channel-sidebar__style-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 3C6.5 3 2 7.1 2 12.2C2 17.3 6.8 21.2 12 21.2C17.5 21.2 22 17.1 22 12.2C22 7.1 17.5 3 12 3Z" />
                <path d="M8 12.5C8 14 9.8 15 12 15C14.2 15 16 14 16 12.5" />
              </svg>
              <svg v-else class="channel-sidebar__style-svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient id="nav-toggle-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#38BDF8" />
                    <stop offset="50%" stop-color="#A855F7" />
                    <stop offset="100%" stop-color="#F43F5E" />
                  </linearGradient>
                </defs>
                <circle cx="12" cy="12" r="9" fill="url(#nav-toggle-grad)" />
                <circle cx="12" cy="12" r="5" fill="#141720" fill-opacity="0.8" />
                <circle cx="13.5" cy="10.5" r="1.2" fill="#FFFFFF" />
              </svg>
            </span>
            <span class="channel-sidebar__style-text">
              {{ navIconStyle === 'playful-line' ? '萌系线条' : '质感渐变' }}
            </span>
            <span class="channel-sidebar__style-pill" :class="{ 'channel-sidebar__style-pill--gradient': navIconStyle === 'gradient' }">
              <span class="channel-sidebar__style-thumb" />
            </span>
          </button>
        </div>
      </nav>
    </div>

    <!-- 移动端 “更多” 浮动弹层 -->
    <Teleport to="body">
      <Transition name="more-sheet">
        <div
          v-if="moreOpen"
          class="mobile-more-overlay"
          :class="{ 'mobile-more-overlay--immersive': immersive }"
          role="dialog"
          aria-modal="true"
          aria-label="更多页面"
          @click.stop
        >
          <div class="mobile-more-overlay__backdrop" @click="closeMore" />
          <div class="mobile-more-sheet">
            <div class="mobile-more-sheet__header">
              <span class="mobile-more-sheet__title">更多频道与模块</span>
              <button
                v-if="showStyleToggle"
                class="mobile-more-sheet__style-toggle"
                type="button"
                :title="navIconStyle === 'playful-line' ? '切换为质感渐变风格' : '切换为萌系线条风格'"
                @click="toggleNavIconStyle"
              >
                <span>{{ navIconStyle === 'playful-line' ? '萌系线条' : '质感渐变' }}</span>
              </button>
              <button
                type="button"
                class="mobile-more-sheet__close"
                aria-label="关闭"
                @click="closeMore"
              >
                ✕
              </button>
            </div>

            <div class="mobile-more-sheet__grid">
              <button
                class="mobile-more-card"
                :class="{ 'mobile-more-card--active': photosActive }"
                type="button"
                @click="selectPhotos"
              >
                <div class="mobile-more-card__icon mobile-more-card__icon--photo">
                  <PhotoNavigationIcon class="mobile-more-card__photo-svg" />
                </div>
                <div class="mobile-more-card__label">照片墙</div>
                <div class="mobile-more-card__desc">摄影与精选集</div>
              </button>

              <button
                class="mobile-more-card"
                :class="{ 'mobile-more-card--active': gamesActive }"
                type="button"
                @click="selectGames"
              >
                <div class="mobile-more-card__icon mobile-more-card__icon--game">
                  <GameNavigationIcon class="mobile-more-card__game-svg" />
                </div>
                <div class="mobile-more-card__label">游戏墙</div>
                <div class="mobile-more-card__desc">通关记录与成就</div>
              </button>

              <button
                class="mobile-more-card"
                :class="{ 'mobile-more-card--active': guestbookActive }"
                type="button"
                @click="selectGuestbook"
              >
                <div class="mobile-more-card__icon mobile-more-card__icon--guestbook">
                  <GuestbookNavigationIcon class="mobile-more-card__guestbook-svg" />
                </div>
                <div class="mobile-more-card__label">留言板</div>
                <div class="mobile-more-card__desc">与博主打个招呼</div>
              </button>

              <button
                class="mobile-more-card"
                :class="{ 'mobile-more-card--active': aiActive }"
                type="button"
                @click="selectAi"
              >
                <div class="mobile-more-card__icon mobile-more-card__icon--ai">
                  <AINavigationIcon class="mobile-more-card__ai-svg" />
                </div>
                <div class="mobile-more-card__label">AI 助手</div>
                <div class="mobile-more-card__desc">智能对话与检索</div>
              </button>

              <button
                class="mobile-more-card"
                :class="{ 'mobile-more-card--active': aboutActive }"
                type="button"
                @click="selectAbout"
              >
                <div class="mobile-more-card__icon mobile-more-card__icon--about">
                  <AboutNavigationIcon class="mobile-more-card__about-svg" />
                </div>
                <div class="mobile-more-card__label">关于我</div>
                <div class="mobile-more-card__desc">履历与个人介绍</div>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- AI 开发中提示 Toast -->
    <Teleport to="body">
      <Transition name="ai-toast">
        <div
          v-if="aiNoticeVisible"
          class="ai-toast-banner"
          role="status"
          aria-live="polite"
        >
          <AINavigationIcon class="ai-toast-banner__icon" />
          <span>开发中，敬请期待</span>
        </div>
      </Transition>
    </Teleport>
  </aside>
</template>

<style scoped>
.channel-sidebar {
  min-width: 0;
  min-height: 0;
  padding: 1.5rem 0 2rem;
}

.channel-sidebar__panel,
.channel-sidebar__navigation {
  height: 100%;
}

.channel-sidebar__navigation {
  display: flex;
  flex-direction: column;
}

.channel-sidebar__edge-trigger {
  display: none;
}

.channel-sidebar__channels {
  display: grid;
  gap: 0.45rem;
}

.channel-sidebar__footer {
  margin-top: auto;
  display: grid;
  gap: 0.45rem;
}

.channel-sidebar__item {
  display: flex;
  width: 100%;
  min-height: 3.4rem;
  align-items: center;
  gap: 0.9rem;
  padding: 0.65rem 1rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 680;
  text-align: left;
  transition: background-color 150ms ease, color 150ms ease;
}

.channel-sidebar__item:hover {
  background: color-mix(in srgb, var(--surface-muted) 58%, transparent);
  color: var(--text-primary);
}

.channel-sidebar__item--active {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.channel-sidebar__life-icon,
.channel-sidebar__article-icon,
.channel-sidebar__interest-icon,
.channel-sidebar__photo-icon,
.channel-sidebar__game-icon,
.channel-sidebar__guestbook-icon,
.channel-sidebar__ai-icon,
.channel-sidebar__about-icon {
  width: 1.35rem;
  height: 1.35rem;
  flex: none;
  transition: transform 160ms var(--ease-card);
}

.channel-sidebar__item:hover .channel-sidebar__life-icon,
.channel-sidebar__item:hover .channel-sidebar__article-icon,
.channel-sidebar__item:hover .channel-sidebar__interest-icon,
.channel-sidebar__item:hover .channel-sidebar__photo-icon,
.channel-sidebar__item:hover .channel-sidebar__game-icon,
.channel-sidebar__item:hover .channel-sidebar__guestbook-icon,
.channel-sidebar__item:hover .channel-sidebar__ai-icon,
.channel-sidebar__item:hover .channel-sidebar__about-icon {
  transform: scale(1.08);
}

.channel-sidebar__item--mobile-more {
  display: none;
}

.channel-sidebar__style-toggle {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 2.35rem;
  margin-top: 0.35rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-muted) 40%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: left;
  transition: all 150ms ease;
}

.channel-sidebar__style-toggle:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.channel-sidebar__style-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.15rem;
  height: 1.15rem;
  flex: none;
}

.channel-sidebar__style-svg {
  width: 100%;
  height: 100%;
}

.channel-sidebar__style-text {
  flex: 1;
  white-space: nowrap;
}

.channel-sidebar__style-pill {
  position: relative;
  width: 2rem;
  height: 1.15rem;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background-color 200ms ease;
  flex: none;
}

.channel-sidebar__style-pill--gradient {
  background: var(--accent);
}

.channel-sidebar__style-thumb {
  position: absolute;
  top: 0.1rem;
  left: 0.1rem;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.channel-sidebar__style-pill--gradient .channel-sidebar__style-thumb {
  transform: translateX(0.85rem);
}

.channel-sidebar--immersive .channel-sidebar__style-toggle {
  border-color: var(--photo-border);
  background: var(--photo-surface-hover);
  color: var(--photo-text-secondary);
}

.channel-sidebar--immersive .channel-sidebar__style-toggle:hover {
  color: var(--photo-text-primary);
}

.mobile-more-sheet__style-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.25rem 0.65rem;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.15));
  border-radius: 999px;
  background: var(--surface-muted, rgba(255, 255, 255, 0.08));
  color: var(--text-muted, rgba(255, 255, 255, 0.7));
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  margin-left: auto;
  margin-right: 0.5rem;
  transition: all 150ms ease;
}

.mobile-more-sheet__style-toggle:active {
  transform: scale(0.95);
}

/* 桌面端沉浸式抽屉交互 */
@media (min-width: 800px) {
  .channel-sidebar--immersive {
    position: fixed;
    z-index: 100;
    top: 0;
    bottom: 0;
    left: 0;
    width: 0;
    padding: 0;
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 2;
    display: flex;
    width: 2.75rem;
    height: 3.5rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--photo-border);
    border-left: 0;
    border-radius: 0 0.85rem 0.85rem 0;
    background: var(--photo-glass-bg);
    color: var(--photo-text-muted);
    cursor: pointer;
    transform: translateY(-50%);
    transition:
      transform 200ms var(--ease-card),
      background-color 150ms ease,
      color 150ms ease;
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger:hover,
  .channel-sidebar--immersive .channel-sidebar__edge-trigger:focus-visible {
    background: rgb(31 31 31 / 88%);
    color: var(--photo-text-primary);
  }

  .channel-sidebar--immersive .channel-sidebar__edge-trigger svg {
    width: 1.35rem;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .channel-sidebar--immersive.channel-sidebar--open .channel-sidebar__edge-trigger {
    transform: translate(210px, -50%);
  }

  .channel-sidebar--immersive .channel-sidebar__panel {
    width: 220px;
    padding: 1.5rem 1rem 2rem;
    border-right: 1px solid var(--photo-border);
    background: var(--photo-glass-bg);
    box-shadow: 1.5rem 0 3.5rem rgb(0 0 0 / 42%);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    opacity: 0;
    pointer-events: none;
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 200ms var(--ease-card),
      opacity 160ms ease,
      visibility 0s linear 200ms;
  }

  .channel-sidebar--immersive.channel-sidebar--open .channel-sidebar__panel {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(0);
    visibility: visible;
    transition-delay: 0s;
  }

  .channel-sidebar--immersive .channel-sidebar__item {
    color: var(--photo-text-secondary);
  }

  .channel-sidebar--immersive .channel-sidebar__item:hover {
    background: var(--photo-surface-hover);
    color: var(--photo-text-primary);
  }

  .channel-sidebar--immersive .channel-sidebar__item--active {
    background: var(--photo-surface-hover);
    color: var(--photo-text-primary);
  }
}

/* 移动端底部 Tab 栏 */
@media (max-width: 799px) {
  .channel-sidebar {
    z-index: 10;
    grid-row: 2;
    padding:
      0.3rem
      max(0.75rem, env(safe-area-inset-right))
      max(0.35rem, env(safe-area-inset-bottom))
      max(0.75rem, env(safe-area-inset-left));
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-page);
    box-shadow: 0 -0.6rem 1.6rem rgb(24 22 20 / 5%);
  }

  .channel-sidebar--immersive {
    border-top-color: var(--photo-border);
    background: var(--photo-canvas);
    box-shadow: 0 -0.6rem 1.6rem rgb(0 0 0 / 24%);
  }

  .channel-sidebar__panel {
    height: auto;
  }

  .channel-sidebar__navigation {
    display: grid;
    width: 100%;
    height: auto;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .channel-sidebar__channels {
    display: contents;
  }

  /* 隐藏在桌面端单独展示的子项 */
  .channel-sidebar__item--desktop,
  .channel-sidebar__footer--desktop {
    display: none !important;
  }

  .channel-sidebar__item {
    width: 100%;
    min-width: 0;
    min-height: 2.75rem;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.82rem;
    font-weight: 650;
    border-radius: 8px;
  }

  .channel-sidebar__life-icon,
  .channel-sidebar__article-icon,
  .channel-sidebar__interest-icon,
  .channel-sidebar__about-icon,
  .channel-sidebar__ai-icon,
  .channel-sidebar__photo-icon,
  .channel-sidebar__game-icon,
  .channel-sidebar__guestbook-icon {
    display: none;
  }

  /* 移动端“更多”按钮 */
  .channel-sidebar__item--mobile-more {
    display: flex;
  }

  .channel-sidebar__item.channel-sidebar__item--active,
  .channel-sidebar__item.channel-sidebar__item--active:hover {
    background: var(--accent-soft);
    color: var(--accent-strong);
  }

  .channel-sidebar--immersive .channel-sidebar__item {
    color: var(--photo-text-secondary);
  }

  .channel-sidebar--immersive .channel-sidebar__item.channel-sidebar__item--active {
    background: var(--photo-surface-hover);
    color: #ffffff;
  }
}

/* 移动端 “更多” 底部弹出 Action Sheet */
.mobile-more-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.mobile-more-overlay__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.mobile-more-sheet {
  position: relative;
  z-index: 2;
  width: 100%;
  max-height: 80vh;
  background: var(--surface-card, #1c1c1e);
  border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.12));
  border-radius: 20px 20px 0 0;
  padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.4);
}

.mobile-more-overlay--immersive .mobile-more-sheet {
  background: #141720;
  border-top-color: rgba(255, 255, 255, 0.15);
}

.mobile-more-sheet__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.15rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
}

.mobile-more-sheet__title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
}

.mobile-more-sheet__close {
  background: transparent;
  border: none;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
  font-size: 1.1rem;
  padding: 0.2rem 0.5rem;
  cursor: pointer;
}

.mobile-more-sheet__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.mobile-more-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem;
  background: var(--surface-muted, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.mobile-more-card:active {
  transform: scale(0.97);
}

.mobile-more-card--active {
  background: var(--accent-soft, rgba(59, 130, 246, 0.18));
  border-color: var(--accent, #3b82f6);
}

.mobile-more-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.6rem;
}

.mobile-more-card__icon svg {
  width: 20px;
  height: 20px;
}

.mobile-more-card__icon--photo {
  background: rgba(56, 189, 248, 0.15);
  color: #38bdf8;
}

.mobile-more-card__icon--game {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
}

.mobile-more-card__icon--ai {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.mobile-more-card__icon--guestbook {
  background: rgba(244, 114, 182, 0.15);
  color: #f472b6;
}

.mobile-more-card__photo-svg,
.mobile-more-card__game-svg,
.mobile-more-card__guestbook-svg,
.mobile-more-card__ai-svg,
.mobile-more-card__about-svg {
  width: 22px;
  height: 22px;
}

.mobile-more-card__icon--about {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.mobile-more-card__label {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary, #ffffff);
  margin-bottom: 0.15rem;
}

.mobile-more-card__desc {
  font-size: 0.72rem;
  color: var(--text-muted, rgba(255, 255, 255, 0.5));
}

/* 动效 */
.more-sheet-enter-active,
.more-sheet-leave-active {
  transition: opacity 220ms ease;
}

.more-sheet-enter-active .mobile-more-sheet,
.more-sheet-leave-active .mobile-more-sheet {
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.more-sheet-enter-from,
.more-sheet-leave-to {
  opacity: 0;
}

.more-sheet-enter-from .mobile-more-sheet,
.more-sheet-leave-to .mobile-more-sheet {
  transform: translateY(100%);
}

.ai-toast-banner {
  position: fixed;
  z-index: 1200;
  top: 1.5rem;
  left: 50%;
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 1.15rem;
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  background: rgb(20 20 22 / 85%);
  color: rgb(244 244 245);
  box-shadow:
    0 12px 32px rgb(0 0 0 / 40%),
    0 0 20px rgb(139 92 246 / 22%);
  font-size: 0.88rem;
  font-weight: 550;
  letter-spacing: 0.01em;
  pointer-events: none;
  transform: translateX(-50%);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.ai-toast-banner__icon {
  width: 1.15rem;
  height: 1.15rem;
  flex: none;
}

.ai-toast-enter-active,
.ai-toast-leave-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.ai-toast-enter-from,
.ai-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -14px) scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .channel-sidebar--immersive .channel-sidebar__edge-trigger,
  .channel-sidebar--immersive .channel-sidebar__panel,
  .more-sheet-enter-active,
  .more-sheet-leave-active,
  .ai-toast-enter-active,
  .ai-toast-leave-active {
    transition: none;
  }
}
</style>
