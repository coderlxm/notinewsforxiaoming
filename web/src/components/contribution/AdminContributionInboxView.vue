<script setup lang="ts">
import { Message } from '@element-plus/icons-vue';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAdminContributions } from '../../composables/useAdminContributions';
import { useSessionStore } from '../../stores/session';
import { showMessage } from '../../utils/message';
import JournalLoading from '../ui/JournalLoading.vue';
import AdminContributionList from './AdminContributionList.vue';

const router = useRouter();
const inbox = useAdminContributions();
const session = useSessionStore();
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);
let persistentMessage: ReturnType<typeof showMessage> | null = null;
const inboxError = computed(() => authenticationError.value
  ?? (authenticationChecked.value && !ownerAuthenticated.value
    ? '请先返回“我的资产”登录，再打开朋友投稿箱。'
    : inbox.listError.value));

function openContribution(publicId: string): void {
  void router.push({ name: 'contribution-review', params: { publicId } });
}

function showPersistentMessage(message: string): void {
  persistentMessage?.close();
  persistentMessage = showMessage({ message, type: 'error', duration: 0 });
}

watch(inboxError, (error) => {
  if (error) showPersistentMessage(error);
  else {
    persistentMessage?.close();
    persistentMessage = null;
  }
}, { immediate: true });

onMounted(async () => {
  await session.load();
  if (ownerAuthenticated.value) await inbox.loadInbox();
  else inbox.clear();
});

onBeforeUnmount(() => persistentMessage?.close());
</script>

<template>
  <main class="contribution-inbox">
    <div class="contribution-inbox__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span>朋友投稿</span>
    </div>

    <header class="contribution-inbox__intro">
      <div>
        <h1>朋友投稿</h1>
        <p>整理朋友送来的文字、照片和视频，再决定如何写入 Journal。</p>
      </div>
      <span v-if="inbox.pendingCount.value" class="contribution-inbox__count">
        {{ inbox.pendingCount.value }} 份待处理
      </span>
    </header>

    <div
      v-if="!authenticationError && (!authenticationChecked || inbox.listLoading.value)"
      class="contribution-inbox__loading"
    >
      <JournalLoading
        variant="reading"
        :label="authenticationChecked ? '正在打开投稿箱…' : '正在确认管理会话…'"
      />
    </div>
    <AdminContributionList
      v-else-if="ownerAuthenticated && inbox.contributions.value.length"
      :contributions="inbox.contributions.value"
      @select="openContribution"
    />
    <section v-else-if="ownerAuthenticated && !inbox.listError.value" class="contribution-inbox__empty">
      <Message class="contribution-inbox__empty-icon" aria-hidden="true" />
      <h2>投稿箱是空的</h2>
      <p>朋友的新内容送达后会出现在这里。</p>
    </section>
  </main>
</template>

<style scoped>
.contribution-inbox {
  display: grid;
  gap: 1.25rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--reading-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.contribution-inbox__heading,
.contribution-inbox__intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.contribution-inbox__heading {
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.contribution-inbox__intro {
  align-items: flex-end;
}

.contribution-inbox__intro h1,
.contribution-inbox__empty h2 {
  margin: 0;
  font-family: var(--font-serif);
}

.contribution-inbox__intro h1 {
  font-size: 1.45rem;
}

.contribution-inbox__intro p,
.contribution-inbox__empty p {
  margin: 0.3rem 0 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.55;
}

.contribution-inbox__count {
  flex: none;
  padding: 0.32rem 0.6rem;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 700;
}

.contribution-inbox__loading {
  min-height: 45vh;
}

.contribution-inbox__empty {
  display: grid;
  min-height: 42vh;
  place-content: center;
  justify-items: center;
  text-align: center;
}

.contribution-inbox__empty-icon {
  color: var(--border-strong);
  width: 3.5rem;
  height: 3.5rem;
}

.contribution-inbox__empty h2 {
  margin-top: 0.7rem;
  font-size: 1.1rem;
}

@media (max-width: 599px) {
  .contribution-inbox__intro {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
