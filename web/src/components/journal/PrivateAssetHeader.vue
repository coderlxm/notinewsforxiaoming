<script setup lang="ts">
import JournalLoading from '../ui/JournalLoading.vue';

defineProps<{
  authenticated: boolean;
  refreshing: boolean;
  refreshDisabled: boolean;
}>();

const emit = defineEmits<{
  refresh: [];
  createEntry: [];
  createArticle: [];
  openSettings: [];
}>();
</script>

<template>
  <div class="private-asset-header">
    <div>
      <span class="private-asset-header__eyebrow">PERSONAL ARCHIVE</span>
      <h1 class="private-asset-header__title">我的全部记录</h1>
    </div>

    <div v-if="authenticated" class="private-asset-header__actions">
      <button
        class="button button--quiet private-asset-header__refresh"
        type="button"
        :disabled="refreshDisabled || refreshing"
        :aria-busy="refreshing"
        @click="emit('refresh')"
      >
        <JournalLoading v-if="refreshing" variant="inline" label="刷新中…" />
        <template v-else>刷新</template>
      </button>
      <button
        class="button button--quiet"
        type="button"
        @click="emit('createEntry')"
      >
        发布内容
      </button>
      <button
        class="button button--quiet"
        type="button"
        @click="emit('createArticle')"
      >
        写文章
      </button>
      <button
        class="button button--quiet"
        type="button"
        @click="emit('openSettings')"
      >
        设置
      </button>
    </div>
  </div>
</template>

<style scoped>
.private-asset-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  min-height: 3.5rem;
  padding: 0 0.15rem;
}

.private-asset-header__eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.17em;
}

.private-asset-header__title {
  margin: 0.18rem 0 0;
  font-family: var(--font-serif);
  font-size: clamp(1.35rem, 4vw, 1.75rem);
  font-weight: 680;
}

.private-asset-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 599px) {
  .private-asset-header {
    align-items: stretch;
    flex-direction: column;
    gap: 0.85rem;
  }

  .private-asset-header__refresh {
    display: none;
  }

  .private-asset-header__actions {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.4rem;
  }

  .private-asset-header__actions .button {
    min-width: 0;
    min-height: 2.5rem;
    padding: 0.5rem 0.2rem;
    font-size: clamp(0.72rem, 3.5vw, 0.8rem);
    white-space: nowrap;
  }
}
</style>
