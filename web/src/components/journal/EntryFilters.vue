<script setup lang="ts">
import { reactive, watch } from 'vue';
import { emptyFeedFilters, type FeedFilters } from '../../types';

const props = defineProps<{
  filters: FeedFilters;
}>();

const emit = defineEmits<{
  apply: [filters: FeedFilters];
}>();

const draft = reactive<FeedFilters>({ ...props.filters });

const visibilityOptions = [
  { value: 'all', label: '全部' },
  { value: 'private', label: '🔒 私有' },
  { value: 'public', label: '🌐 公开' },
] satisfies { value: FeedFilters['visibility']; label: string }[];

const contentTypes = [
  { value: '', label: '全部格式' },
  { value: 'text', label: '文字' },
  { value: 'photo', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'video_note', label: '圆形视频' },
  { value: 'voice', label: '语音' },
  { value: 'audio', label: '音频' },
  { value: 'document', label: '文件' },
  { value: 'sticker', label: '贴纸' },
  { value: 'contact', label: '联系人' },
  { value: 'location', label: '位置' },
  { value: 'venue', label: '地点' },
  { value: 'poll', label: '投票' },
  { value: 'dice', label: '骰子' },
  { value: 'game', label: '游戏' },
  { value: 'story', label: 'Story 引用' },
  { value: 'paid_media', label: '付费媒体元数据' },
  { value: 'article', label: '文章' },
];

watch(
  () => [
    props.filters.visibility,
    props.filters.query,
    props.filters.tag,
    props.filters.contentType,
    props.filters.from,
    props.filters.to,
  ] as const,
  ([visibility, query, tag, contentType, from, to]) => {
    Object.assign(draft, { visibility, query, tag, contentType, from, to });
  },
);

function apply(): void {
  emit('apply', { ...draft });
}

function reset(): void {
  Object.assign(draft, emptyFeedFilters());
  apply();
}
</script>

<template>
  <form class="filters" @submit.prevent="apply">
    <div class="filters__visibility" aria-label="可见性筛选">
      <label v-for="option in visibilityOptions" :key="option.value" class="filters__choice">
        <input v-model="draft.visibility" type="radio" name="visibility" :value="option.value">
        <span>{{ option.label }}</span>
      </label>
    </div>

    <div class="filters__search-row">
      <label class="field filters__query">
        <span class="field__label">正文关键词</span>
        <input v-model.trim="draft.query" type="search" placeholder="搜索记录">
      </label>
      <label class="field filters__tag">
        <span class="field__label">标签</span>
        <input v-model.trim="draft.tag" type="text" placeholder="例如：旅行">
      </label>
      <label class="field filters__type">
        <span class="field__label">格式</span>
        <select v-model="draft.contentType">
          <option v-for="contentType in contentTypes" :key="contentType.value" :value="contentType.value">
            {{ contentType.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="filters__date-row">
      <label class="field">
        <span class="field__label">从</span>
        <input v-model="draft.from" type="date">
      </label>
      <label class="field">
        <span class="field__label">到</span>
        <input v-model="draft.to" type="date">
      </label>
      <div class="filters__actions">
        <button class="button button--quiet" type="button" @click="reset">清空</button>
        <button class="button button--primary" type="submit">筛选</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.filters {
  display: grid;
  gap: 0.9rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.filters__visibility {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.filters__choice {
  cursor: pointer;
}

.filters__choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.filters__choice span {
  display: block;
  padding: 0.42rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.filters__choice input:checked + span {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.filters__choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.filters__search-row,
.filters__date-row {
  display: grid;
  gap: 0.7rem;
}

.filters__search-row {
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(8rem, 0.7fr);
}

.filters__date-row {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
}

.filters__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.45rem;
}

@media (max-width: 620px) {
  .filters {
    margin: 0 1rem;
  }

  .filters__search-row,
  .filters__date-row {
    grid-template-columns: 1fr;
  }
}
</style>
