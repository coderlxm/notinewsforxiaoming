<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSession, logout as apiLogout } from './api'
import LoginPanel from './components/LoginPanel.vue'
import DashboardView from './components/DashboardView.vue'

type Status = 'checking' | 'guest' | 'authenticated'

const status = ref<Status>('checking')
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const session = await getSession()
    status.value = session.authenticated ? 'authenticated' : 'guest'
  } catch (cause) {
    error.value = (cause as Error).message
  }
})

function onLogin() {
  status.value = 'authenticated'
}

async function onLogout() {
  error.value = null
  try {
    await apiLogout()
    status.value = 'guest'
  } catch (cause) {
    error.value = (cause as Error).message
  }
}
</script>

<template>
  <main v-if="status === 'checking'" class="app-state">
    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-else>正在确认访问状态…</p>
  </main>
  <LoginPanel v-else-if="status === 'guest'" @authenticated="onLogin" />
  <DashboardView v-else :session-error="error" @logout="onLogout" />
</template>
