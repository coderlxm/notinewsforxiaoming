<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef } from 'vue';
import ArticleEditorView from './components/article/ArticleEditorView.vue';
import FeedView from './components/journal/FeedView.vue';

type AppRoute =
  | { name: 'public'; key: string; tag: string }
  | { name: 'detail'; key: string; publicId: string }
  | { name: 'private'; key: string }
  | { name: 'article-new'; key: string }
  | { name: 'article-edit'; key: string; articleId: number }
  | { name: 'not-found'; key: string };

const locationKey = shallowRef(`${window.location.pathname}${window.location.search}`);

const route = computed<AppRoute>(() => {
  const url = new URL(locationKey.value, window.location.origin);
  if (url.pathname === '/') {
    const tag = url.searchParams.get('tag') ?? '';
    return { name: 'public', key: `public:${tag}`, tag };
  }
  if (url.pathname === '/me') return { name: 'private', key: 'private' };
  if (url.pathname === '/me/articles/new') {
    return { name: 'article-new', key: 'article-new' };
  }
  const editMatch = url.pathname.match(/^\/me\/articles\/(\d+)\/edit$/);
  if (editMatch) {
    const articleId = Number(editMatch[1]);
    return { name: 'article-edit', key: `article-edit:${articleId}`, articleId };
  }
  if (url.pathname.startsWith('/p/')) {
    const publicId = decodeURIComponent(url.pathname.slice(3));
    return { name: 'detail', key: `detail:${publicId}`, publicId };
  }
  return { name: 'not-found', key: url.pathname };
});

function synchronizeLocation(): void {
  locationKey.value = `${window.location.pathname}${window.location.search}`;
}

function navigate(path: string): void {
  window.history.pushState(null, '', path);
  synchronizeLocation();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => window.addEventListener('popstate', synchronizeLocation));
onUnmounted(() => window.removeEventListener('popstate', synchronizeLocation));
</script>

<template>
  <div class="app-shell">
    <header class="profile">
      <button class="profile__home" type="button" aria-label="返回公开首页" @click="navigate('/')">
        <img class="profile__avatar" src="/avatar-ming.png" alt="小明同学">
      </button>
      <div class="profile__copy">
        <button class="profile__name" type="button" @click="navigate('/')">小明同学</button>
        <p class="profile__bio">姚黄魏紫开次第，不觉成恨俱零凋</p>
      </div>
      <nav class="profile__nav" aria-label="主导航">
        <button
          class="profile__nav-link"
          :class="{ 'profile__nav-link--active': route.name === 'public' || route.name === 'detail' }"
          type="button"
          @click="navigate('/')"
        >
          公开记录
        </button>
        <button
          class="profile__nav-link"
          :class="{ 'profile__nav-link--active': route.name === 'private' || route.name === 'article-new' || route.name === 'article-edit' }"
          type="button"
          @click="navigate('/me')"
        >
          我的资产
        </button>
      </nav>
    </header>

    <FeedView
      v-if="route.name === 'public'"
      :key="route.key"
      mode="public"
      :initial-tag="route.tag"
      @navigate="navigate"
    />
    <FeedView
      v-else-if="route.name === 'detail'"
      :key="route.key"
      mode="public"
      :detail-id="route.publicId"
      @navigate="navigate"
    />
    <FeedView
      v-else-if="route.name === 'private'"
      :key="route.key"
      mode="private"
      @navigate="navigate"
    />
    <ArticleEditorView
      v-else-if="route.name === 'article-new'"
      :key="route.key"
      @navigate="navigate"
    />
    <ArticleEditorView
      v-else-if="route.name === 'article-edit'"
      :key="route.key"
      :article-id="route.articleId"
      @navigate="navigate"
    />
    <main v-else class="not-found">
      <span class="not-found__code">404</span>
      <h1>这条路没有记录</h1>
      <button class="button button--primary" type="button" @click="navigate('/')">返回首页</button>
    </main>

    <footer class="site-footer">
      <span>小明同学的生活记录</span>
      <span aria-hidden="true">·</span>
      <a href="/rss.xml">RSS</a>
      <a href="/feed.json">JSON Feed</a>
    </footer>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.profile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  width: min(calc(100% - 2rem), var(--content-width));
  margin: 0 auto;
  padding: 1.2rem 0 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.profile__home,
.profile__name,
.profile__nav-link {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.profile__home {
  padding: 0;
  border-radius: 50%;
}

.profile__avatar {
  display: block;
  width: 3.35rem;
  height: 3.35rem;
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--surface-page), 0 0 0 4px var(--border-strong);
}

.profile__copy {
  min-width: 0;
}

.profile__name {
  padding: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 750;
}

.profile__bio {
  margin: 0.2rem 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile__nav {
  display: flex;
  gap: 0.15rem;
  padding: 0.2rem;
  border-radius: 999px;
  background: var(--surface-muted);
}

.profile__nav-link {
  padding: 0.48rem 0.7rem;
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.profile__nav-link--active {
  background: var(--surface-card);
  color: var(--text-primary);
  box-shadow: 0 1px 4px rgb(40 29 25 / 8%);
}

.not-found {
  display: grid;
  min-height: 55vh;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.not-found__code {
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: 4rem;
  line-height: 1;
}

.not-found h1 {
  margin: 0.5rem 0 1.2rem;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}

.site-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 1.8rem 1rem 2.6rem;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.site-footer a {
  color: inherit;
}

@media (max-width: 620px) {
  .profile {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .profile__nav {
    grid-column: 1 / -1;
    justify-content: stretch;
  }

  .profile__nav-link {
    flex: 1;
  }
}
</style>
