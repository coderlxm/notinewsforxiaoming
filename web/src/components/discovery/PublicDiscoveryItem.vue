<script setup lang="ts">
import { computed } from 'vue';
import { journalChannels } from '../../journalChannels';
import type {
  JournalDiscoveryEntrySummary,
  JournalDiscoveryListItem,
  ProtectedJournalEntryPreview,
} from '../../types';
import PublicDiscoveryHighlight from './PublicDiscoveryHighlight.vue';

const props = withDefaults(defineProps<{
  entry: JournalDiscoveryListItem;
  query?: string;
}>(), {
  query: '',
});

const emit = defineEmits<{
  open: [entry: JournalDiscoveryListItem];
}>();

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function isProtectedPreview(
  entry: JournalDiscoveryListItem,
): entry is ProtectedJournalEntryPreview {
  return entry.kind === 'protected';
}

function entryTitle(entry: JournalDiscoveryEntrySummary): string | null {
  return entry.title;
}

function entryTypeLabel(entry: JournalDiscoveryListItem): string {
  if (isProtectedPreview(entry)) {
    return entry.entryType === 'article' ? '加密文章' : '加密记录';
  }
  return entry.entryType === 'article' ? '文章' : '记录';
}

const protectedPreview = computed(() => isProtectedPreview(props.entry));
const title = computed(() => {
  const entry = props.entry;
  return isProtectedPreview(entry) ? entryTypeLabel(entry) : entryTitle(entry);
});
const channelLabel = computed(() =>
  journalChannels.find(channel => channel.value === props.entry.channel)!.label,
);
const formattedDate = computed(() => dateFormatter.format(new Date(props.entry.sourceCreatedAt)));
</script>

<template>
  <article
    class="discovery-item"
    :class="{ 'discovery-item--protected': protectedPreview }"
  >
    <button
      class="discovery-item__button"
      type="button"
      @click="emit('open', entry)"
    >
      <span class="discovery-item__date-rail">
        <time :datetime="entry.sourceCreatedAt">{{ formattedDate }}</time>
      </span>

      <span class="discovery-item__body">
        <span class="discovery-item__eyebrow">
          <span>{{ channelLabel }}</span>
          <template v-if="!protectedPreview">
            <span aria-hidden="true">·</span>
            <span>{{ entryTypeLabel(entry) }}</span>
            <span v-if="entry.kind === 'entry' && entry.visibility === 'protected'" class="discovery-item__access">
              口令保护
            </span>
          </template>
        </span>

        <strong v-if="title" class="discovery-item__title">
          <PublicDiscoveryHighlight :text="title" :query="query" />
        </strong>

        <template v-if="entry.kind === 'entry'">
          <span v-if="entry.excerpt" class="discovery-item__excerpt">
            <PublicDiscoveryHighlight :text="entry.excerpt" :query="query" />
          </span>
          <span v-if="entry.tags.length" class="discovery-item__tags" aria-label="标签">
            <span v-for="tag in entry.tags" :key="tag" class="discovery-item__tag">
              #<PublicDiscoveryHighlight :text="tag" :query="query" />
            </span>
          </span>
        </template>

        <span v-else class="discovery-item__protected-copy">
          内容受密码保护，进入后可验证访问。
        </span>
      </span>

      <svg class="discovery-item__arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="m9 5 7 7-7 7" />
      </svg>
    </button>
  </article>
</template>

<style scoped>
.discovery-item {
  border-bottom: 1px solid var(--border-subtle);
}

.discovery-item:first-child {
  border-top: 1px solid var(--border-subtle);
}

.discovery-item__button {
  display: grid;
  width: 100%;
  grid-template-columns: 7.8rem minmax(0, 1fr) auto;
  align-items: start;
  gap: 1.35rem;
  padding: 1.35rem 0.2rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background-color 150ms ease;
}

.discovery-item__button:hover {
  background: color-mix(in srgb, var(--surface-muted) 46%, transparent);
}

.discovery-item__date-rail {
  padding-top: 0.2rem;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}

.discovery-item__body {
  display: grid;
  min-width: 0;
  gap: 0.52rem;
}

.discovery-item__eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 720;
  letter-spacing: 0.08em;
}

.discovery-item__access {
  padding: 0.1rem 0.34rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  letter-spacing: 0;
}

.discovery-item__title {
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: clamp(1rem, 2vw, 1.16rem);
  line-height: 1.55;
}

.discovery-item__excerpt,
.discovery-item__protected-copy {
  display: -webkit-box;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.82rem;
  line-height: 1.75;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.discovery-item__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.65rem;
}

.discovery-item__tag {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.discovery-item__arrow {
  width: 1.1rem;
  margin-top: 1.45rem;
  color: var(--border-strong);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  transition: color 150ms ease, transform 150ms ease;
}

.discovery-item__button:hover .discovery-item__arrow {
  color: var(--accent);
  transform: translateX(2px);
}

.discovery-item--protected .discovery-item__title {
  color: var(--text-muted);
}

@media (max-width: 640px) {
  .discovery-item__button {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.8rem;
    padding: 1.1rem 0.15rem;
  }

  .discovery-item__date-rail {
    grid-column: 1 / -1;
    padding: 0;
  }

  .discovery-item__body {
    grid-column: 1;
  }

  .discovery-item__arrow {
    grid-column: 2;
    margin-top: 1.1rem;
  }
}
</style>
