<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';
import ContributionForm from './components/contribution/ContributionForm.vue';
import ContributionHeader from './components/contribution/ContributionHeader.vue';
import ContributionSuccess from './components/contribution/ContributionSuccess.vue';
import type { ContributionSuccessResult } from './composables/useContributionSubmit';
import { showMessage } from './utils/message';

type LinkState = 'loading' | 'ready' | 'error';

interface ContributionLinkResponse {
  expiresAt: string;
  limits: {
    maxAssets: number;
    maxVideos: number;
    maxTotalBytes: number;
    maxImageBytes: number;
    maxVideoBytes: number;
    maxImagePixels: number;
    maxVideoDuration: number;
    maxSenderNameLength: number;
    maxContentTextLength: number;
  };
}

const linkState = shallowRef<LinkState>('loading');
const linkInfo = shallowRef<ContributionLinkResponse | null>(null);
const successResult = shallowRef<ContributionSuccessResult | null>(null);

const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';

function linkErrorMessage(code?: string): string {
  if (code === 'LINK_EXPIRED') return '这条投稿链接已经过期，请向小明获取新的链接。';
  if (code === 'LINK_REVOKED') return '这条投稿链接已经失效，请向小明获取新的链接。';
  return '无法确认投稿链接，请检查链接是否完整。';
}

function showLinkError(error: string): void {
  linkState.value = 'error';
  showMessage({ message: error, type: 'error', duration: 0 });
}

async function loadContributionLink(): Promise<void> {
  if (!token) {
    showLinkError('投稿链接不完整，请重新打开小明分享的链接。');
    return;
  }

  try {
    const response = await fetch('/api/contribution-link', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const body = await response.json() as ContributionLinkResponse | {
      error: { code: string };
    };

    if (!response.ok) {
      showLinkError(linkErrorMessage('error' in body ? body.error.code : undefined));
      return;
    }

    linkInfo.value = body as ContributionLinkResponse;
    linkState.value = 'ready';
  } catch {
    showLinkError('无法连接 Journal，请稍后重新打开这条投稿链接。');
  }
}

function handleSubmitted(result: ContributionSuccessResult): void {
  successResult.value = result;
}

function startAnotherContribution(): void {
  successResult.value = null;
}

onMounted(() => {
  void loadContributionLink();
});
</script>

<template>
  <main class="contribution-page">
    <div class="contribution-shell">
      <ContributionHeader />

      <section
        v-if="linkState === 'loading'"
        class="contribution-card contribution-link-state"
        aria-live="polite"
      >
        <span class="contribution-status-dot" aria-hidden="true"></span>
        <p>正在确认投稿链接…</p>
      </section>

      <ContributionSuccess
        v-else-if="successResult"
        :result="successResult"
        @restart="startAnotherContribution"
      />

      <ContributionForm
        v-else-if="linkInfo"
        :token="token"
        :expires-at="linkInfo.expiresAt"
        @submitted="handleSubmitted"
      />
    </div>
  </main>
</template>
