<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, onUpdated, shallowRef } from 'vue';
import { onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import { fetchPublicDiscoveryArchive } from '../../api';
import { usePublicDiscoveryCache } from '../../composables/usePublicDiscoveryCache';
import type { JournalDiscoveryArchiveOverview } from '../../types';
import JournalLoading from '../ui/JournalLoading.vue';
import { discoveryErrorMessage, publicArchiveMonthPath } from './discoveryRoutes';
import { usePublicDiscoveryHead } from './usePublicDiscoveryHead';

defineOptions({ name: 'PublicArchiveView' });

const props = defineProps<{
  accessScope: string;
}>();

const emit = defineEmits<{
  layoutReady: [];
}>();

const route = useRoute();
const router = useRouter();
const cache = usePublicDiscoveryCache();
const years = shallowRef<JournalDiscoveryArchiveOverview['years']>([]);
const loading = shallowRef(true);
const error = shallowRef<string | null>(null);
let activeIdentity = '';

const canonicalPath = '/archive';

function archiveHead() {
  return {
    title: '时间归档 · 小明同学',
    robots: 'index, follow' as const,
    canonicalPath,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: '时间归档',
      url: new URL(canonicalPath, window.location.origin).href,
    },
  };
}

const pageHead = usePublicDiscoveryHead(archiveHead);

async function announceLayout(identityAtRequest: string): Promise<void> {
  await nextTick();
  if (activeIdentity === identityAtRequest) emit('layoutReady');
}

async function loadArchive(): Promise<void> {
  const identityAtRequest = `${props.accessScope}\u0000${canonicalPath}`;
  activeIdentity = identityAtRequest;
  error.value = null;

  const cached = cache.read<JournalDiscoveryArchiveOverview>(props.accessScope, canonicalPath);
  if (cached) {
    years.value = cached.years;
    loading.value = false;
    await announceLayout(identityAtRequest);
    return;
  }

  loading.value = true;
  try {
    const response = await fetchPublicDiscoveryArchive();
    cache.write(props.accessScope, canonicalPath, response);
    if (activeIdentity !== identityAtRequest) return;
    years.value = response.years;
  }
  catch (reason) {
    if (activeIdentity === identityAtRequest) error.value = discoveryErrorMessage(reason);
  }
  finally {
    if (activeIdentity === identityAtRequest) {
      loading.value = false;
      await announceLayout(identityAtRequest);
    }
  }
}

onBeforeRouteUpdate((to) => {
  if (to.fullPath !== canonicalPath) return canonicalPath;
  if (!activeIdentity) void loadArchive();
});

onMounted(() => {
  if (route.fullPath !== canonicalPath) {
    void router.replace(canonicalPath);
    return;
  }
  void loadArchive();
});

onUpdated(() => {
  pageHead.apply(archiveHead());
});

onBeforeUnmount(() => {
  activeIdentity = '';
});
</script>

<template>
  <main class="archive-view">
    <header class="archive-view__header">
      <p class="archive-view__eyebrow">ARCHIVE</p>
      <h1 class="archive-view__title">时间归档</h1>
      <p class="archive-view__description">按年月回看公开记录、文章与受保护内容。</p>
    </header>

    <JournalLoading v-if="loading" label="正在整理时间归档…" />

    <section v-else-if="error" class="archive-view__state archive-view__state--error" role="alert">
      <h2>归档没有加载完成</h2>
      <p>{{ error }}</p>
    </section>

    <section v-else-if="years.length === 0" class="archive-view__state" aria-live="polite">
      <h2>还没有可以归档的公开内容</h2>
      <p>公开内容发布后，会按时间出现在这里。</p>
    </section>

    <div v-else class="archive-view__years">
      <section
        v-for="yearEntry in years"
        :key="yearEntry.year"
        class="archive-year"
        :aria-labelledby="`archive-year-${yearEntry.year}`"
      >
        <h2 :id="`archive-year-${yearEntry.year}`" class="archive-year__title">
          {{ yearEntry.year }}
        </h2>
        <div class="archive-year__months">
          <RouterLink
            v-for="monthEntry in yearEntry.months"
            :key="monthEntry.month"
            class="archive-month"
            :to="publicArchiveMonthPath(yearEntry.year, monthEntry.month)"
          >
            <span class="archive-month__number">{{ String(monthEntry.month).padStart(2, '0') }}</span>
            <span class="archive-month__label">{{ monthEntry.month }}月</span>
            <span class="archive-month__count">{{ monthEntry.count }} 项</span>
            <svg class="archive-month__arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" />
            </svg>
          </RouterLink>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.archive-view {
  display: grid;
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.2rem) 0 5rem;
}

.archive-view__header {
  display: grid;
  gap: 0.45rem;
  margin-bottom: clamp(2rem, 5vw, 3.6rem);
}

.archive-view__eyebrow,
.archive-view__title,
.archive-view__description,
.archive-view__state h2,
.archive-view__state p,
.archive-year__title {
  margin: 0;
}

.archive-view__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 780;
  letter-spacing: 0.2em;
}

.archive-view__title,
.archive-view__state h2,
.archive-year__title {
  font-family: var(--font-serif);
}

.archive-view__title {
  font-size: clamp(1.7rem, 4vw, 2.45rem);
}

.archive-view__description,
.archive-view__state p {
  color: var(--text-muted);
  font-size: 0.84rem;
  line-height: 1.7;
}

.archive-view__state {
  display: grid;
  min-height: 18rem;
  align-content: center;
  gap: 0.65rem;
  padding: clamp(1.4rem, 4vw, 2.2rem);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.archive-view__state h2 {
  font-size: 1.15rem;
}

.archive-view__state--error {
  border-color: color-mix(in srgb, var(--danger) 32%, var(--border-subtle));
}

.archive-view__state--error h2,
.archive-view__state--error p {
  color: var(--danger);
}

.archive-view__years {
  display: grid;
  gap: clamp(2.4rem, 6vw, 4rem);
}

.archive-year {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 1.5rem;
}

.archive-year__title {
  color: var(--text-primary);
  font-size: 1.55rem;
  font-variant-numeric: tabular-nums;
}

.archive-year__months {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.archive-month {
  display: grid;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.25rem 0.65rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  color: inherit;
  text-decoration: none;
  transition: border-color 150ms ease, transform 150ms ease;
}

.archive-month:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
}

.archive-month__number {
  grid-column: 1 / -1;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 1.65rem;
  font-weight: 720;
  line-height: 1;
}

.archive-month__label,
.archive-month__count {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.archive-month__arrow {
  width: 0.95rem;
  color: var(--border-strong);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
}

@media (max-width: 760px) {
  .archive-year {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .archive-year__months {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 420px) {
  .archive-year__months {
    grid-template-columns: 1fr;
  }
}
</style>
