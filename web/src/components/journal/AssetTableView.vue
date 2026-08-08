<script setup lang="ts">
import { Connection, Document, Lock, Top } from '@element-plus/icons-vue';
import { ElTable, ElTableColumn } from 'element-plus';
import { computed } from 'vue';
import type { JournalEntry, JournalPlainChannel, JournalVisibility } from '../../types';
import { formatEntryTime, formatFileSize } from '../../utils/formatters';
import AssetTableActions from './AssetTableActions.vue';
import AssetTableChannelCell from './AssetTableChannelCell.vue';
import AssetTableContentCell from './AssetTableContentCell.vue';
import JournalAssetTablePlaceholder from './JournalAssetTablePlaceholder.vue';

const props = defineProps<{
  entries: readonly JournalEntry[];
  loading: boolean;
  mutationEntryId: number | null;
}>();

const emit = defineEmits<{
  view: [entry: JournalEntry];
  edit: [entry: JournalEntry];
  editPublishedTime: [entry: JournalEntry];
  setPinned: [entry: JournalEntry, pinned: boolean];
  setVisibility: [entry: JournalEntry, visibility: JournalVisibility];
  deleteEntry: [entry: JournalEntry];
  selectTag: [tag: string];
  setChannel: [entry: JournalEntry, channel: JournalPlainChannel];
}>();

const contentTypeLabels: Record<string, string> = {
  text: '文字',
  photo: '图片',
  video: '视频',
  video_note: '圆形视频',
  voice: '语音',
  audio: '音频',
  document: '文件',
  sticker: '贴纸',
  contact: '联系人',
  location: '位置',
  venue: '地点',
  poll: '投票',
  dice: '骰子',
  game: '游戏',
  story: 'Story 引用',
  paid_media: '付费媒体',
  article: '文章',
};

const rows = computed(() => props.entries.map((entry) => {
  const knownSizes = entry.assets
    .map(asset => asset.byteSize)
    .filter((size): size is number => size !== null);
  const totalSize = entry.assets.length > 0 && knownSizes.length === entry.assets.length
    ? knownSizes.reduce((total, size) => total + size, 0)
    : null;
  const sizeLabel = formatFileSize(totalSize);

  return {
    id: entry.id,
    entry,
    sourceTime: formatEntryTime(entry.sourceCreatedAt),
    updatedTime: formatEntryTime(entry.updatedAt),
    sourceLabel: entry.sourceKind === 'telegram' ? 'Telegram' : 'Web',
    typeLabel: entry.bodyFormat === 'rich'
      ? '文章'
      : contentTypeLabels[entry.contentType] ?? entry.contentType,
    statusLabel: entry.publicationStatus === 'draft'
      ? '草稿'
      : entry.visibility === 'public' ? '公开' : '私有',
    assetLabel: `${entry.assets.length} 项${sizeLabel ? ` · ${sizeLabel}` : ''}`,
  };
}));

function forwardSetPinned(entry: JournalEntry, pinned: boolean): void {
  emit('setPinned', entry, pinned);
}

function forwardSetVisibility(entry: JournalEntry, visibility: JournalVisibility): void {
  emit('setVisibility', entry, visibility);
}
</script>

<template>
  <div class="asset-table" :class="{ 'asset-table--loading': loading }" :aria-busy="loading">
    <ElTable
      :data="rows"
      row-key="id"
      table-layout="fixed"
      empty-text=" "
      aria-label="我的资产表格"
    >
      <ElTableColumn label="时间" width="190">
        <template #default="{ row }">
          <div class="asset-table__time">
            <time :datetime="row.entry.sourceCreatedAt">{{ row.sourceTime }}</time>
            <span>更新 {{ row.updatedTime }}</span>
            <span v-if="row.entry.pinned" class="asset-table__pinned">
              <Top aria-hidden="true" />
              置顶
            </span>
          </div>
        </template>
      </ElTableColumn>

      <ElTableColumn label="内容" min-width="360">
        <template #default="{ row }">
          <AssetTableContentCell
            :entry="row.entry"
            :type-label="row.typeLabel"
            @select-tag="emit('selectTag', $event)"
          />
        </template>
      </ElTableColumn>

      <ElTableColumn label="所属板块" width="96">
        <template #default="{ row }">
          <AssetTableChannelCell
            :entry="row.entry"
            :busy="mutationEntryId === row.entry.id"
            @set-channel="emit('setChannel', row.entry, $event)"
          />
        </template>
      </ElTableColumn>

      <ElTableColumn label="状态" width="96">
        <template #default="{ row }">
          <span class="asset-table__status">
            <Document v-if="row.entry.publicationStatus === 'draft'" aria-hidden="true" />
            <Connection v-else-if="row.entry.visibility === 'public'" aria-hidden="true" />
            <Lock v-else aria-hidden="true" />
            {{ row.statusLabel }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn label="类型" width="130">
        <template #default="{ row }">
          <span class="asset-table__type">
            <strong>{{ row.typeLabel }}</strong>
            <small>{{ row.sourceLabel }}</small>
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn label="素材" width="120">
        <template #default="{ row }">
          <span class="asset-table__assets">{{ row.assetLabel }}</span>
        </template>
      </ElTableColumn>

      <ElTableColumn label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <AssetTableActions
            :entry="row.entry"
            :busy="mutationEntryId === row.entry.id"
            @edit="emit('edit', $event)"
            @view="emit('view', $event)"
            @edit-published-time="emit('editPublishedTime', $event)"
            @set-pinned="forwardSetPinned"
            @set-visibility="forwardSetVisibility"
            @delete-entry="emit('deleteEntry', $event)"
          />
        </template>
      </ElTableColumn>
    </ElTable>
    <div v-if="loading" class="asset-table__loading">
      <JournalAssetTablePlaceholder />
    </div>
  </div>
</template>

<style scoped>
.asset-table {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.asset-table--loading {
  min-height: 32.75rem;
}

.asset-table__loading {
  position: absolute;
  z-index: 3;
  inset: 2.75rem 0 0;
  overflow: hidden;
  background: var(--surface-card);
}

.asset-table__loading :deep(.asset-table-placeholder) {
  border: 0;
  border-radius: 0;
}

.asset-table__loading :deep(.asset-table-placeholder__header) {
  display: none;
}

.asset-table :deep(.el-table) {
  --el-table-bg-color: var(--surface-card);
  --el-table-tr-bg-color: var(--surface-card);
  --el-table-header-bg-color: color-mix(in srgb, var(--surface-muted) 60%, var(--surface-card));
  --el-table-row-hover-bg-color: color-mix(in srgb, var(--accent-soft) 42%, var(--surface-card));
  --el-table-border-color: var(--border-subtle);
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-muted);
  background: var(--surface-card);
  font-size: 0.76rem;
}

.asset-table :deep(.el-table::before) {
  display: none;
}

.asset-table :deep(.el-table th.el-table__cell) {
  height: 2.75rem;
  padding: 0;
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.05em;
}

.asset-table :deep(.el-table td.el-table__cell) {
  height: 5rem;
  padding: 0.65rem 0;
}

.asset-table :deep(.el-table .cell) {
  padding: 0 0.75rem;
  line-height: 1.45;
}

.asset-table__time,
.asset-table__type {
  display: grid;
  gap: 0.2rem;
}

.asset-table__time time,
.asset-table__type strong {
  color: var(--text-primary);
  font-weight: 680;
}

.asset-table__time > span,
.asset-table__type small,
.asset-table__assets {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.asset-table__pinned,
.asset-table__status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.asset-table__pinned {
  color: var(--accent-strong) !important;
}

.asset-table__pinned svg,
.asset-table__status svg {
  width: 0.86rem;
  height: 0.86rem;
}

.asset-table__status {
  color: var(--text-muted);
  white-space: nowrap;
}

.asset-table :deep(.el-table-fixed-column--right) {
  background: var(--surface-card);
  box-shadow: -1px 0 0 0 var(--border-subtle);
}

.asset-table__assets {
  white-space: nowrap;
}
</style>
