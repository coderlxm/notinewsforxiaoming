<script setup lang="ts">
import QRCode from 'qrcode';
import { computed, onMounted, shallowRef, watch } from 'vue';
import { useAdminContributionLink } from '../../composables/useAdminContributionLink';
import type { ContributionLinkLifetime } from '../../types';
import { formatEntryTime } from '../../utils/formatters';
import { showMessage } from '../../utils/message';
import JournalLoading from '../ui/JournalLoading.vue';

const contributionLink = useAdminContributionLink();
const qrCodeUrl = shallowRef<string | null>(null);
const copied = shallowRef(false);
const selectedLifetime = shallowRef<ContributionLinkLifetime>('temporary');
let qrSequence = 0;

const shareUrl = computed(() => contributionLink.link.value?.url ?? null);
const activeExpiresAt = computed(() => contributionLink.link.value?.expiresAt ?? null);
const busy = computed(() => contributionLink.mutation.value !== null);
const canSystemShare = computed(() =>
  shareUrl.value !== null && typeof navigator.share === 'function',
);

watch(shareUrl, async (url) => {
  const sequence = ++qrSequence;
  qrCodeUrl.value = null;
  if (!url) return;
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: {
        dark: '#20201e',
        light: '#ffffff',
      },
    });
    if (sequence === qrSequence) qrCodeUrl.value = dataUrl;
  }
  catch (reason) {
    if (sequence === qrSequence) contributionLink.setError(reason);
  }
}, { immediate: true });

watch(contributionLink.error, (error) => {
  if (error) showMessage({ message: error, type: 'error' });
});

async function createLink(): Promise<void> {
  if (
    contributionLink.link.value
    && !window.confirm('创建新链接会立即使当前分享链接失效，确定继续吗？')
  ) return;
  copied.value = false;
  await contributionLink.create(selectedLifetime.value);
}

async function copyLink(): Promise<void> {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    copied.value = true;
  }
  catch (reason) {
    contributionLink.setError(reason);
  }
}

async function shareLink(): Promise<void> {
  if (!shareUrl.value) return;
  try {
    await navigator.share({
      title: '送给小明',
      text: '用这条链接把聚会照片、视频和想说的话送给小明。',
      url: shareUrl.value,
    });
  }
  catch (reason) {
    contributionLink.setError(reason);
  }
}

async function revokeLink(): Promise<void> {
  if (!window.confirm('确定撤销当前投稿链接吗？朋友打开后将无法继续投稿。')) return;
  copied.value = false;
  await contributionLink.revoke();
}

onMounted(() => {
  void contributionLink.load();
});
</script>

<template>
  <section class="link-settings" aria-labelledby="contribution-link-title">
    <div class="link-settings__heading">
      <div>
        <h2 id="contribution-link-title" class="link-settings__title">朋友投稿链接</h2>
        <p>创建时选择有效期，同一时间只保留一条。</p>
      </div>
      <div class="link-settings__create">
        <fieldset
          class="link-settings__lifetime"
          aria-label="投稿链接有效期"
          :disabled="busy || contributionLink.loading.value"
        >
          <label class="link-settings__choice">
            <input v-model="selectedLifetime" type="radio" value="temporary">
            <span>72 小时</span>
          </label>
          <label class="link-settings__choice">
            <input v-model="selectedLifetime" type="radio" value="permanent">
            <span>长期有效</span>
          </label>
        </fieldset>
        <button
          class="button button--quiet"
          type="button"
          :disabled="busy || contributionLink.loading.value"
          :aria-busy="contributionLink.mutation.value === 'create'"
          @click="createLink"
        >
          <JournalLoading
            v-if="contributionLink.mutation.value === 'create'"
            variant="inline"
            label="创建中…"
          />
          <template v-else>{{ contributionLink.link.value ? '创建新链接' : '创建链接' }}</template>
        </button>
      </div>
    </div>

    <div v-if="contributionLink.loading.value" class="link-settings__loading">
      <JournalLoading variant="inline" label="正在读取投稿链接…" />
    </div>
    <div v-else-if="contributionLink.link.value" class="link-settings__active">
      <div class="link-settings__content">
        <div class="link-settings__status">
          <span class="link-settings__status-label">
            {{ activeExpiresAt ? '当前链接有效' : '当前链接长期有效' }}
          </span>
          <time
            v-if="activeExpiresAt"
            :datetime="activeExpiresAt"
          >
            {{ formatEntryTime(activeExpiresAt) }} 到期
          </time>
          <span v-else class="link-settings__status-meta">
            {{ formatEntryTime(contributionLink.link.value.createdAt) }} 创建
          </span>
        </div>

        <template v-if="shareUrl">
          <div class="link-settings__share">
            <div class="link-settings__url">
              <span :title="shareUrl">{{ shareUrl }}</span>
              <button class="button button--quiet" type="button" :disabled="busy" @click="copyLink">
                <span aria-live="polite">{{ copied ? '已复制' : '复制' }}</span>
              </button>
            </div>
            <button
              v-if="canSystemShare"
              class="button button--quiet"
              type="button"
              :disabled="busy"
              @click="shareLink"
            >
              系统分享
            </button>
          </div>
        </template>
        <p v-else class="link-settings__lost-url">
          出于安全考虑，服务端只保存令牌摘要，无法再次读取这条链接。若链接没有保存，请创建新链接。
        </p>

        <button
          class="link-settings__revoke"
          type="button"
          :disabled="busy"
          :aria-busy="contributionLink.mutation.value === 'revoke'"
          @click="revokeLink"
        >
          <JournalLoading
            v-if="contributionLink.mutation.value === 'revoke'"
            variant="inline"
            label="撤销中…"
          />
          <template v-else>撤销当前链接</template>
        </button>
      </div>

      <figure v-if="shareUrl && qrCodeUrl" class="link-settings__qr">
        <img :src="qrCodeUrl" alt="朋友投稿链接二维码">
        <figcaption>让朋友扫码打开投稿页</figcaption>
      </figure>
    </div>
    <p v-else class="link-settings__empty">
      目前没有可用的投稿链接。创建后可以直接分享、复制或让朋友扫描二维码。
    </p>
  </section>
</template>

<style scoped>
.link-settings {
  display: grid;
  gap: 1.25rem;
}

.link-settings__heading,
.link-settings__status,
.link-settings__share,
.link-settings__url {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.link-settings__create,
.link-settings__lifetime {
  display: flex;
  align-items: center;
}

.link-settings__create {
  gap: 0.65rem;
}

.link-settings__lifetime {
  gap: 0.25rem;
  margin: 0;
  padding: 0.2rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--surface-page);
}

.link-settings__choice {
  cursor: pointer;
}

.link-settings__choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.link-settings__choice span {
  display: inline-flex;
  min-height: 1.85rem;
  align-items: center;
  padding: 0.35rem 0.65rem;
  border-radius: 7px;
  color: var(--text-muted);
  font-size: 0.74rem;
  white-space: nowrap;
}

.link-settings__choice input:checked + span {
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 700;
}

.link-settings__choice input:focus-visible + span {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.link-settings__lifetime:disabled .link-settings__choice {
  cursor: wait;
  opacity: 0.55;
}

.link-settings__title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.link-settings__heading p,
.link-settings__empty,
.link-settings__lost-url {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.55;
}

.link-settings__loading {
  min-height: 3rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.link-settings__active {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 1.25rem;
  padding: 1.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

.link-settings__content {
  display: grid;
  min-width: 0;
  gap: 0.95rem;
}

.link-settings__status-label {
  color: var(--accent-strong);
  font-size: 0.78rem;
  font-weight: 700;
}

.link-settings__status time,
.link-settings__status-meta {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.link-settings__share {
  align-items: stretch;
}

.link-settings__url {
  min-width: 0;
  flex: 1;
  padding-left: 0.7rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-page);
}

.link-settings__url > span {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-settings__url .button {
  flex: none;
  border-width: 0 0 0 1px;
  border-radius: 0 8px 8px 0;
}

.link-settings__qr {
  display: grid;
  justify-items: center;
  gap: 0.45rem;
  width: clamp(11rem, 18vw, 13rem);
  margin: 0;
  padding: 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: #fff;
}

.link-settings__qr img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
}

.link-settings__qr figcaption {
  color: #72716c;
  font-size: 0.7rem;
}

.link-settings__revoke {
  justify-self: start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--danger);
  cursor: pointer;
  font-size: 0.74rem;
}

.link-settings__empty {
  margin-top: 0;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-card);
}

@media (max-width: 719px) {
  .link-settings__active {
    grid-template-columns: minmax(0, 1fr);
  }

  .link-settings__qr {
    justify-self: center;
    width: min(13rem, 100%);
  }
}

@media (max-width: 599px) {
  .link-settings__heading,
  .link-settings__status,
  .link-settings__share {
    align-items: stretch;
    flex-direction: column;
  }

  .link-settings__heading .button,
  .link-settings__share > .button {
    width: 100%;
  }

  .link-settings__create {
    align-items: stretch;
    flex-direction: column;
  }

  .link-settings__lifetime {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .link-settings__choice span {
    justify-content: center;
  }
}
</style>
