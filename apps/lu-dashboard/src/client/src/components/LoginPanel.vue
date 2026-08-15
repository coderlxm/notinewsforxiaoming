<script setup lang="ts">
import { ref } from 'vue'
import { login } from '../api'

const emit = defineEmits<{ (e: 'authenticated'): void }>()

const password = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit() {
  submitting.value = true
  error.value = null
  try {
    await login(password.value)
    emit('authenticated')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <form class="login-card" @submit.prevent="onSubmit">
      <div class="login-header">
        <span class="header-tag">AUTHENTICATION</span>
        <h1>私人看板访问</h1>
      </div>
      <div class="login-field">
        <label for="password">ACCESS KEY / 密码</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          :disabled="submitting"
        />
      </div>
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? '验证中…' : '进入看板' }}
      </button>
      <p v-if="error" class="login-error">{{ error }}</p>
    </form>
  </div>
</template>
