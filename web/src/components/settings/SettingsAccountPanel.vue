<script setup lang="ts">
import JournalLoading from '../ui/JournalLoading.vue';

defineProps<{
  loggingOut: boolean;
}>();

const emit = defineEmits<{
  logout: [];
}>();
</script>

<template>
  <section class="account-panel" aria-labelledby="account-settings-title">
    <div class="account-panel__heading">
      <h2 id="account-settings-title">账户</h2>
      <p>管理当前浏览器中的管理员登录状态。</p>
    </div>

    <div class="account-panel__action">
      <div class="account-panel__copy">
        <strong>退出当前登录</strong>
        <span>退出后需要重新输入管理员密码才能访问个人资产。</span>
      </div>
      <button
        class="button button--quiet account-panel__logout"
        type="button"
        :disabled="loggingOut"
        :aria-busy="loggingOut"
        @click="emit('logout')"
      >
        <JournalLoading v-if="loggingOut" variant="inline" label="退出中…" />
        <template v-else>退出登录</template>
      </button>
    </div>
  </section>
</template>

<style scoped>
.account-panel,
.account-panel__heading,
.account-panel__copy {
  display: grid;
}

.account-panel {
  gap: 1.1rem;
}

.account-panel__heading {
  gap: 0.25rem;
}

.account-panel__heading h2,
.account-panel__heading p {
  margin: 0;
}

.account-panel__heading h2 {
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.account-panel__heading p,
.account-panel__copy span {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.account-panel__action {
  display: flex;
  width: min(100%, 32rem);
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.account-panel__copy {
  gap: 0.22rem;
}

.account-panel__copy strong {
  font-size: 0.86rem;
}

.account-panel__copy span {
  line-height: 1.5;
}

.account-panel__logout {
  flex: none;
  color: var(--danger);
}

@media (max-width: 599px) {
  .account-panel__action {
    align-items: stretch;
    flex-direction: column;
  }

  .account-panel__logout {
    align-self: start;
  }
}
</style>
