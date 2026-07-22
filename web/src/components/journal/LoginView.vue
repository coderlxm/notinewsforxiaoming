<script setup lang="ts">
import { shallowRef } from 'vue';
import JournalLoading from '../ui/JournalLoading.vue';

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
    <p id="login-description" class="login__copy">这里包含公开动态与随手保存的私有记录。</p>
    <form class="login__form" @submit.prevent="submit">
      <label class="field">
        <span class="field__label">账号</span>
        <input
          type="text"
          name="username"
          value="xiaoming"
          autocomplete="username"
          readonly
        >
      </label>
      <label class="field">
        <span class="field__label">管理密码</span>
        <input
          v-model="password"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          aria-describedby="login-description"
          :disabled="busy"
        >
      </label>
      <button class="button button--primary login__submit" type="submit" :disabled="busy" :aria-busy="busy">
        <JournalLoading v-if="busy" variant="inline" label="登录中…" />
        <template v-else>登录</template>
      </button>
    </form>
  </section>
</template>

<style scoped>
.login {
  position: relative;
  display: grid;
  width: min(100%, 27rem);
  margin: clamp(2rem, 8vh, 5rem) auto;
  padding: 2rem 2rem 2rem 3.4rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
  overflow: hidden;
  text-align: center;
}

.login::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2rem;
  border-right: 1px solid var(--border-subtle);
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 11px,
    color-mix(in srgb, var(--graphite) 28%, transparent) 11px 12px
  );
  content: '';
}

.login__mark {
  display: grid;
  width: 2.4rem;
  height: 3.25rem;
  margin: 0 auto 0.9rem;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 700;
  place-items: center;
}

.login__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 720;
}

.login__copy {
  margin: 0.55rem 0 1.4rem;
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

@media (max-width: 599px) {
  .login {
    padding: 1.5rem 1.25rem 1.5rem 2.8rem;
  }

  .login::before {
    width: 1.65rem;
  }
}
</style>
