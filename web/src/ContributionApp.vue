<script setup lang="ts">
import { nextTick, onMounted, shallowRef, useTemplateRef } from 'vue';
import ContributionForm from './components/contribution/ContributionForm.vue';
import ContributionHeader from './components/contribution/ContributionHeader.vue';
import ContributionSuccess from './components/contribution/ContributionSuccess.vue';
import type { ContributionSuccessResult } from './composables/useContributionSubmit';

type LinkState = 'loading' | 'ready' | 'error';

interface ContributionLinkResponse {
  expiresAt: string;
  limits: {
    maxAssets: number;
    maxVideos: number;
    maxTotalBytes: number;
    maxImageBytes: number;
    maxVideoBytes: number;
    maxSenderNameLength: number;
    maxContentTextLength: number;
  };
}

const linkState = shallowRef<LinkState>('loading');
const linkError = shallowRef('');
const linkInfo = shallowRef<ContributionLinkResponse | null>(null);
const successResult = shallowRef<ContributionSuccessResult | null>(null);
const linkErrorElement = useTemplateRef<HTMLElement>('linkError');

const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';

function linkErrorMessage(code?: string): string {
  if (code === 'LINK_EXPIRED') return '这条投稿链接已经过期，请向小明获取新的链接。';
  if (code === 'LINK_REVOKED') return '这条投稿链接已经失效，请向小明获取新的链接。';
  return '无法确认投稿链接，请检查链接是否完整。';
}

async function showLinkError(message: string): Promise<void> {
  linkError.value = message;
  linkState.value = 'error';
  await nextTick();
  linkErrorElement.value?.focus();
}

async function loadContributionLink(): Promise<void> {
  if (!token) {
    await showLinkError('投稿链接不完整，请重新打开小明分享的链接。');
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
      await showLinkError(linkErrorMessage('error' in body ? body.error.code : undefined));
      return;
    }

    linkInfo.value = body as ContributionLinkResponse;
    linkState.value = 'ready';
  } catch {
    await showLinkError('无法连接 Journal，请稍后重新打开这条投稿链接。');
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

      <section
        v-else-if="linkState === 'error'"
        ref="linkError"
        class="contribution-card contribution-link-state contribution-link-state--error"
        role="alert"
        tabindex="-1"
      >
        <h2>暂时不能投稿</h2>
        <p>{{ linkError }}</p>
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
