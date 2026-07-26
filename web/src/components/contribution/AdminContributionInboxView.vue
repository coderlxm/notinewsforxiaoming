<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useAdminContributions } from '../../composables/useAdminContributions';
import { useSessionStore } from '../../stores/session';
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

function openContribution(publicId: string): void {
  void router.push({ name: 'contribution-review', params: { publicId } });
}
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

    <p v-if="authenticationError" class="notice notice--error" role="alert">
      {{ authenticationError }}
    </p>
    <p
      v-else-if="authenticationChecked && !ownerAuthenticated"
      class="notice notice--error"
      role="alert"
    >
      请先返回“我的资产”登录，再打开朋友投稿箱。
    </p>
    <p v-else-if="inbox.listError.value" class="notice notice--error" role="alert">
      {{ inbox.listError.value }}
    </p>
    <div
      v-else-if="!authenticationChecked || inbox.listLoading.value"
      class="contribution-inbox__loading"
    >
      <JournalLoading
        variant="reading"
        :label="authenticationChecked ? '正在打开投稿箱…' : '正在确认管理会话…'"
      />
    </div>
    <AdminContributionList
      v-else-if="inbox.contributions.value.length"
      :contributions="inbox.contributions.value"
      @select="openContribution"
    />
    <section v-else class="contribution-inbox__empty">
      <span aria-hidden="true">✉</span>
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

.contribution-inbox__empty > span {
  color: var(--border-strong);
  font-family: var(--font-serif);
  font-size: 3.5rem;
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
