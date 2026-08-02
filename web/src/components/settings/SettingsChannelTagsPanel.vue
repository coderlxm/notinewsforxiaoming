<script setup lang="ts">
import { reactive } from 'vue';
import type { ChannelTags, JournalChannel } from '../../types';
import { showMessage } from '../../utils/message';

const MAX_CHANNEL_TAGS = 8;
const MAX_CHANNEL_TAG_LENGTH = 32;

type ChannelTagKey = JournalChannel;

const channelTags = defineModel<ChannelTags>({ required: true });

const props = withDefaults(defineProps<{
  disabled?: boolean;
}>(), {
  disabled: false,
});

const channelTagGroups: Array<{ key: ChannelTagKey; label: string }> = [
  { key: 'life', label: '生活' },
  { key: 'article', label: '文章' },
  { key: 'interest', label: '兴趣' },
];

const tagInputs = reactive<Record<ChannelTagKey, string>>({
  life: '',
  article: '',
  interest: '',
});

function replaceChannelTags(channel: ChannelTagKey, tags: string[]): void {
  channelTags.value = {
    ...channelTags.value,
    [channel]: tags,
  };
}

function addChannelTag(channel: ChannelTagKey): void {
  const tag = tagInputs[channel].trim();
  if (!tag) return;
  if (tag.includes('#')) {
    showMessage({ message: '标签名称不需要输入 #。', type: 'error' });
    return;
  }
  if (tag === '全部') {
    showMessage({ message: '“全部”是固定入口，不需要配置。', type: 'error' });
    return;
  }

  const tags = channelTags.value[channel];
  if (tags.includes(tag)) {
    showMessage({ message: `“${tag}”已经在当前频道中。`, type: 'error' });
    return;
  }
  if (tags.length >= MAX_CHANNEL_TAGS) {
    showMessage({ message: `每个频道最多配置 ${MAX_CHANNEL_TAGS} 个标签。`, type: 'error' });
    return;
  }

  replaceChannelTags(channel, [...tags, tag]);
  tagInputs[channel] = '';
}

function removeChannelTag(channel: ChannelTagKey, index: number): void {
  replaceChannelTags(channel, channelTags.value[channel].filter((_, itemIndex) => itemIndex !== index));
}

function moveChannelTag(channel: ChannelTagKey, index: number, offset: -1 | 1): void {
  const tags = [...channelTags.value[channel]];
  const targetIndex = index + offset;
  [tags[index], tags[targetIndex]] = [tags[targetIndex]!, tags[index]!];
  replaceChannelTags(channel, tags);
}
</script>

<template>
  <section class="channel-tags" aria-labelledby="channel-tags-title">
    <div class="channel-tags__heading">
      <h2 id="channel-tags-title">频道标签</h2>
      <p>编排公开信息流的常驻标签及展示顺序，每个频道最多 {{ MAX_CHANNEL_TAGS }} 个。</p>
    </div>

    <div class="channel-tags__groups">
      <section
        v-for="group in channelTagGroups"
        :key="group.key"
        class="channel-tags__group"
        :aria-labelledby="`channel-tags-${group.key}`"
      >
        <div class="channel-tags__group-heading">
          <h3 :id="`channel-tags-${group.key}`">{{ group.label }}</h3>
          <span>{{ channelTags[group.key].length }} / {{ MAX_CHANNEL_TAGS }}</span>
        </div>

        <div class="channel-tags__input-row">
          <input
            v-model="tagInputs[group.key]"
            type="text"
            :maxlength="MAX_CHANNEL_TAG_LENGTH"
            :placeholder="`添加${group.label}标签`"
            :aria-label="`添加${group.label}标签`"
            :disabled="props.disabled || channelTags[group.key].length >= MAX_CHANNEL_TAGS"
            @keydown.enter.prevent="addChannelTag(group.key)"
          >
          <button
            class="button button--quiet"
            type="button"
            :disabled="props.disabled || channelTags[group.key].length >= MAX_CHANNEL_TAGS"
            @click="addChannelTag(group.key)"
          >
            添加
          </button>
        </div>

        <ol v-if="channelTags[group.key].length" class="channel-tags__list">
          <li
            v-for="(tag, index) in channelTags[group.key]"
            :key="tag"
            class="channel-tags__item"
          >
            <span>{{ tag }}</span>
            <div class="channel-tags__item-actions">
              <button
                type="button"
                :aria-label="`向前移动${tag}`"
                :disabled="props.disabled || index === 0"
                @click="moveChannelTag(group.key, index, -1)"
              >
                ←
              </button>
              <button
                type="button"
                :aria-label="`向后移动${tag}`"
                :disabled="props.disabled || index === channelTags[group.key].length - 1"
                @click="moveChannelTag(group.key, index, 1)"
              >
                →
              </button>
              <button
                class="channel-tags__remove"
                type="button"
                :aria-label="`删除${tag}`"
                :disabled="props.disabled"
                @click="removeChannelTag(group.key, index)"
              >
                删除
              </button>
            </div>
          </li>
        </ol>
        <p v-else class="channel-tags__empty">暂未配置常驻标签</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.channel-tags {
  display: grid;
  gap: 0.8rem;
}

.channel-tags__heading h2,
.channel-tags__group-heading h3 {
  margin: 0;
}

.channel-tags__heading h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
}

.channel-tags__heading p {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.channel-tags__groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.channel-tags__group {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.channel-tags__group-heading,
.channel-tags__input-row,
.channel-tags__item,
.channel-tags__item-actions {
  display: flex;
  align-items: center;
}

.channel-tags__group-heading {
  justify-content: space-between;
  gap: 0.5rem;
}

.channel-tags__group-heading h3 {
  font-size: 0.82rem;
}

.channel-tags__group-heading span,
.channel-tags__empty {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.channel-tags__input-row {
  gap: 0.4rem;
}

.channel-tags__input-row input {
  width: 100%;
}

.channel-tags__input-row .button {
  flex: none;
}

.channel-tags__list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.channel-tags__item {
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: var(--surface-card);
}

.channel-tags__item > span {
  overflow: hidden;
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-tags__item-actions {
  flex: none;
  gap: 0.2rem;
}

.channel-tags__item-actions button {
  min-width: 1.7rem;
  min-height: 1.7rem;
  padding: 0 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.68rem;
}

.channel-tags__item-actions button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.channel-tags__item-actions button:disabled {
  cursor: default;
  opacity: 0.35;
}

.channel-tags__item-actions .channel-tags__remove {
  color: var(--danger);
}

.channel-tags__empty {
  margin: 0;
  padding: 0.45rem 0;
  text-align: center;
}

@media (max-width: 599px) {
  .channel-tags__groups {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 600px) and (max-width: 900px) {
  .channel-tags__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
