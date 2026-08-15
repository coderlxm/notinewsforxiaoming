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
  <form class="login-panel" @submit.prevent="onSubmit">
    <div>
      <p class="eyebrow">PRIVATE LOG</p>
      <h1>私人看板</h1>
    </div>
    <label for="password">密码</label>
    <input
      id="password"
      v-model="password"
      type="password"
      autocomplete="current-password"
      :disabled="submitting"
    />
    <button type="submit" :disabled="submitting">
      {{ submitting ? '登录中…' : '登录' }}
    </button>
    <p v-if="error" class="login-error">{{ error }}</p>
  </form>
</template>
