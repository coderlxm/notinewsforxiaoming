<script setup lang="ts">
import { Connection, Lock } from '@element-plus/icons-vue';
import { useDebounceFn } from '@vueuse/core';
import { computed, reactive, shallowRef } from 'vue';
import { emptyFeedFilters, type AssetView, type FeedFilters } from '../../types';
import AssetViewSwitch from './AssetViewSwitch.vue';

const props = defineProps<{
  filters: FeedFilters;
  view: AssetView;
}>();

const emit = defineEmits<{
  apply: [filters: FeedFilters];
  changeView: [view: AssetView];
}>();

const draft = reactive<FeedFilters>({ ...props.filters });
const expanded = shallowRef(false);

const visibilityOptions = [
  { value: 'all', label: '全部' },
  { value: 'private', label: '私有' },
  { value: 'public', label: '公开' },
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

const appliedFilterLabels = computed(() => {
  const labels: string[] = [];
  const visibility = visibilityOptions.find((option) => option.value === props.filters.visibility);
  const contentType = contentTypes.find((option) => option.value === props.filters.contentType);

  if (props.filters.visibility !== 'all' && visibility) labels.push(visibility.label);
  if (props.filters.query) labels.push(`“${props.filters.query}”`);
  if (props.filters.tag) labels.push(`#${props.filters.tag}`);
  if (props.filters.contentType && contentType) labels.push(contentType.label);
  if (props.filters.from || props.filters.to) {
    labels.push(`${props.filters.from || '最早'} — ${props.filters.to || '今天'}`);
  }

  return labels;
});

const filterSummary = computed(() => {
  if (appliedFilterLabels.value.length === 0) return '全部记录';
  const visibleLabels = appliedFilterLabels.value.slice(0, 2).join(' · ');
  const remainingCount = appliedFilterLabels.value.length - 2;
  return remainingCount > 0 ? `${visibleLabels} 等 ${appliedFilterLabels.value.length} 项` : visibleLabels;
});
const hasDraftFilters = computed(() =>
  draft.visibility !== 'all'
  || draft.query !== ''
  || draft.tag !== ''
  || draft.contentType !== ''
  || draft.from !== ''
  || draft.to !== '',
);

const queueApply = useDebounceFn(() => {
  emit('apply', { ...draft });
}, 350);

function changeView(view: AssetView): void {
  emit('changeView', view);
}

function reset(): void {
  Object.assign(draft, emptyFeedFilters());
  void queueApply();
}
</script>

<template>
  <section class="toolbar" aria-label="资产管理工具栏">
    <div class="toolbar__main">
      <label class="field toolbar__search">
        <span class="field__label">正文关键词</span>
        <input
          v-model.trim="draft.query"
          type="search"
          placeholder="搜索记录"
          @input="queueApply"
        >
      </label>
      <AssetViewSwitch :view="view" @change="changeView" />
    </div>

    <div
      class="toolbar__details"
      :class="{ 'toolbar__details--expanded': expanded }"
    >
      <button
        class="toolbar__toggle"
        type="button"
        aria-controls="asset-toolbar-panel"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="toolbar__toggle-label">筛选</span>
        <span class="toolbar__summary">{{ filterSummary }}</span>
        <span class="toolbar__toggle-text" aria-hidden="true">{{ expanded ? '收起' : '展开' }}</span>
      </button>

      <div
        id="asset-toolbar-panel"
        class="toolbar__panel"
      >
        <div class="toolbar__visibility" aria-label="可见性筛选">
          <label v-for="option in visibilityOptions" :key="option.value" class="toolbar__choice">
            <input
              v-model="draft.visibility"
              type="radio"
              name="visibility"
              :value="option.value"
              @change="queueApply"
            >
            <span>
              <Lock v-if="option.value === 'private'" aria-hidden="true" />
              <Connection v-else-if="option.value === 'public'" aria-hidden="true" />
              {{ option.label }}
            </span>
          </label>
        </div>

        <label class="field toolbar__tag">
          <span class="field__label">标签</span>
          <input
            v-model.trim="draft.tag"
            type="text"
            placeholder="例如：旅行"
            @input="queueApply"
          >
        </label>
        <label class="field toolbar__type">
          <span class="field__label">格式</span>
          <select v-model="draft.contentType" @change="queueApply">
            <option v-for="contentType in contentTypes" :key="contentType.value" :value="contentType.value">
              {{ contentType.label }}
            </option>
          </select>
        </label>

        <div class="toolbar__date-range" role="group" aria-label="日期范围">
          <label class="field">
            <span class="field__label">从</span>
            <input v-model="draft.from" type="date" @change="queueApply">
          </label>
          <label class="field">
            <span class="field__label">到</span>
            <input v-model="draft.to" type="date" @change="queueApply">
          </label>
        </div>
        <button
          class="button button--quiet toolbar__clear"
          type="button"
          :disabled="!hasDraftFilters"
          @click="reset"
        >
          清空
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.toolbar {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  overflow: hidden;
}

.toolbar__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.8rem;
}

.toolbar__details {
  border-top: 1px solid var(--border-subtle);
  background: color-mix(in srgb, var(--surface-muted) 34%, var(--surface-card));
}

.toolbar__toggle {
  display: none;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: 100%;
  min-height: 3rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem 0.7rem;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
}

.toolbar__toggle-label {
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.toolbar__summary {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar__toggle-text {
  color: var(--text-muted);
  font-size: 0.74rem;
}

.toolbar__panel {
  display: grid;
  grid-template-columns: minmax(9rem, 1fr) minmax(8rem, 0.8fr) minmax(16rem, 1.4fr) auto;
  align-items: end;
  gap: 0.7rem;
  padding: 0.8rem;
}

.toolbar__visibility {
  display: flex;
  grid-column: 1 / -1;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.toolbar__choice {
  cursor: pointer;
}

.toolbar__choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toolbar__choice span {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--surface-card);
  color: var(--text-muted);
  font-size: 0.8rem;
}

.toolbar__choice svg {
  width: 0.9rem;
  height: 0.9rem;
}

.toolbar__choice input:checked + span {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.toolbar__choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.toolbar__date-range {
  display: grid;
  min-width: 0;
  grid-template-columns: repeat(2, minmax(8rem, 1fr));
  gap: 0.5rem;
}

@media (max-width: 1119px) and (min-width: 760px) {
  .toolbar__panel {
    grid-template-columns: minmax(9rem, 1fr) minmax(8rem, 0.8fr) auto;
  }

  .toolbar__date-range {
    grid-column: 1 / 3;
  }
}

@media (max-width: 759px) {
  .toolbar__main {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.55rem;
    padding: 0.6rem 0.7rem;
  }

  .toolbar__toggle {
    display: grid;
  }

  .toolbar__panel {
    display: none;
    grid-template-columns: 1fr;
    padding: 0.8rem;
    border-top: 1px solid var(--border-subtle);
  }

  .toolbar__details--expanded .toolbar__panel {
    display: grid;
  }

  .toolbar__date-range {
    grid-template-columns: 1fr;
  }
}
</style>
