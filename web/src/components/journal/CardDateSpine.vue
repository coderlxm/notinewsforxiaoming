<script setup lang="ts">
import { computed } from 'vue';
import type { JournalPublicationStatus, JournalVisibility } from '../../types';

const props = withDefaults(defineProps<{
  sourceCreatedAt: string;
  pinned?: boolean;
  visibility?: JournalVisibility;
  publicationStatus?: JournalPublicationStatus;
  showStatus?: boolean;
  showYear?: boolean;
  linkable?: boolean;
}>(), {
  pinned: false,
  visibility: 'private',
  publicationStatus: 'published',
  showStatus: false,
  showYear: false,
  linkable: false,
});

const emit = defineEmits<{
  open: [];
}>();

const date = computed(() => new Date(props.sourceCreatedAt));
const month = computed(() => new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  month: 'short',
}).format(date.value).toUpperCase());
const day = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  day: '2-digit',
}).format(date.value));
const year = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
}).format(date.value));
const time = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date.value));
const fullDateTime = computed(() => new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(date.value));
</script>

<template>
  <div class="date-spine" :class="{ 'date-spine--with-status': showStatus }">
    <component
      :is="linkable ? 'button' : 'div'"
      class="date-spine__date"
      :class="{ 'date-spine__date--link': linkable }"
      :type="linkable ? 'button' : undefined"
      :aria-label="linkable ? `打开 ${fullDateTime} 的记录` : undefined"
      @click="linkable && emit('open')"
    >
      <span class="date-spine__month">{{ month }}</span>
      <span class="date-spine__day">{{ day }}</span>
    </component>

    <div class="date-spine__meta">
      <span v-if="showYear" class="date-spine__year">{{ year }}</span>
      <time
        :class="{ 'date-spine__time--with-year': showYear }"
        :datetime="sourceCreatedAt"
        :title="fullDateTime"
      >
        {{ time }}
      </time>
      <span v-if="pinned" class="date-spine__pin" title="已置顶" aria-label="已置顶">📌</span>
      <span v-if="showStatus" class="date-spine__status">
        {{ publicationStatus === 'draft' ? '草稿' : (visibility === 'public' ? '公开' : '私有') }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.date-spine {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
}

.date-spine__date {
  display: flex;
  min-height: 2.25rem;
  flex: none;
  align-items: center;
  gap: 0.28rem;
  padding: 0.35rem 0.55rem;
  border: 0;
  border-left: 3px solid var(--accent);
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: var(--font-condensed);
  line-height: 1;
  text-align: left;
}

.date-spine__date--link {
  cursor: pointer;
}

.date-spine__date--link:hover {
  background: var(--accent-soft);
}

.date-spine__date--link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.date-spine__month {
  color: var(--accent-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.date-spine__day {
  font-size: 1.05rem;
  font-weight: 800;
}

.date-spine__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.38rem;
  color: var(--text-muted);
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
}

.date-spine__pin {
  font-size: 0.7rem;
}

.date-spine__year {
  color: var(--text-primary);
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.date-spine__time--with-year {
  padding-left: 0.38rem;
  border-left: 1px solid var(--border-subtle);
}

.date-spine__status {
  padding-left: 0.38rem;
  border-left: 1px solid var(--border-subtle);
  white-space: nowrap;
}

@media (max-width: 599px) {
  .date-spine {
    gap: 0.42rem;
  }

  .date-spine__meta {
    font-size: 0.65rem;
  }

  .date-spine--with-status .date-spine__meta time {
    display: none;
  }

  .date-spine--with-status .date-spine__status {
    padding-left: 0;
    border-left: 0;
  }
}
</style>
