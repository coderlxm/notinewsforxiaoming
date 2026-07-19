<script setup lang="ts">
import { shallowRef } from 'vue';

defineProps<{
  busy: boolean;
}>();

const emit = defineEmits<{
  login: [password: string];
}>();

const password = shallowRef('');

function submit(): void {
  emit('login', password.value);
}
</script>

<template>
  <section class="login" aria-labelledby="login-title">
    <div class="login__mark" aria-hidden="true">私</div>
    <h1 id="login-title" class="login__title">进入个人资产</h1>
    <p class="login__copy">这里包含公开动态与随手保存的私有记录。</p>
    <form class="login__form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">管理密码</span>
        <input
          v-model="password"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          :disabled="busy"
        >
      </label>
      <button class="button button--primary login__submit" type="submit" :disabled="busy">
        {{ busy ? '登录中…' : '登录' }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  display: grid;
  width: min(100%, 26rem);
  margin: 3rem auto;
  padding: 1.6rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.login__mark {
  display: grid;
  width: 3rem;
  height: 3rem;
  margin: 0 auto 0.9rem;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  place-items: center;
}

.login__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.4rem;
}

.login__copy {
  margin: 0.55rem 0 1.3rem;
  color: var(--text-muted);
  font-size: 0.88rem;
}

.login__form {
  display: grid;
  gap: 0.8rem;
  text-align: left;
}

.login__submit {
  width: 100%;
}
</style>
