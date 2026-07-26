<script setup lang="ts">
import { useFileDialog, useObjectUrl } from '@vueuse/core';
import { storeToRefs } from 'pinia';
import { computed, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import JournalLoading from '../ui/JournalLoading.vue';
import { useSessionStore } from '../../stores/session';
import { useSiteProfileStore } from '../../stores/siteProfile';

const MAX_BIO_LENGTH = 120;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const router = useRouter();
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);
const { profile, loading, loadError } = storeToRefs(siteProfile);
const draftBio = shallowRef('');
const draftAvatarFile = shallowRef<File | null>(null);
const formError = shallowRef<string | null>(null);
const submitting = shallowRef(false);
const initialized = shallowRef(false);
const draftAvatarPreviewUrl = useObjectUrl(draftAvatarFile);
const {
  open: openFileDialog,
  reset: resetFileDialog,
  onChange: onAvatarChange,
} = useFileDialog({
  accept: 'image/jpeg,image/png,image/webp',
  multiple: false,
  reset: true,
});

const normalizedDraftBio = computed(() => draftBio.value.trim());
const bioLength = computed(() => normalizedDraftBio.value.length);
const previewAvatarUrl = computed(() =>
  draftAvatarPreviewUrl.value ?? profile.value?.avatarUrl ?? null,
);
const validationError = computed(() =>
  bioLength.value > MAX_BIO_LENGTH ? `Bio 不能超过 ${MAX_BIO_LENGTH} 个字符。` : null,
);
const visibleError = computed(() => formError.value ?? validationError.value);
const waitingForAccess = computed(() =>
  authenticationError.value === null
  && (
    !authenticationChecked.value
    || (ownerAuthenticated.value && loading.value)
  ),
);
const canSubmit = computed(() =>
  ownerAuthenticated.value
  && profile.value !== null
  && !submitting.value
  && validationError.value === null,
);

watch(profile, (value) => {
  if (!value || initialized.value) return;
  draftBio.value = value.bio;
  initialized.value = true;
}, { immediate: true });

onAvatarChange((files) => {
  const file = files?.item(0);
  if (!file) return;
  if (!AVATAR_TYPES.has(file.type)) {
    draftAvatarFile.value = null;
    formError.value = '头像仅支持 JPEG、PNG 或 WebP 图片。';
    return;
  }
  if (file.size > MAX_AVATAR_BYTES) {
    draftAvatarFile.value = null;
    formError.value = '头像文件不能超过 5 MB。';
    return;
  }
  draftAvatarFile.value = file;
  formError.value = null;
});

function chooseAvatar(): void {
  openFileDialog();
}

async function save(): Promise<void> {
  if (!canSubmit.value) return;
  formError.value = null;
  submitting.value = true;
  try {
    const updated = await siteProfile.update(
      normalizedDraftBio.value,
      draftAvatarFile.value,
    );
    draftBio.value = updated.bio;
    draftAvatarFile.value = null;
    resetFileDialog();
  }
  catch (reason) {
    formError.value = reason instanceof Error ? reason.message : String(reason);
  }
  finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="settings-view">
    <div class="settings-view__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span>设置</span>
    </div>

    <p v-if="authenticationError" class="notice notice--error" role="alert">
      {{ authenticationError }}
    </p>
    <p v-else-if="authenticationChecked && !ownerAuthenticated" class="notice notice--error" role="alert">
      请先返回“我的资产”登录后再修改公开资料。
    </p>
    <p v-else-if="loadError" class="notice notice--error" role="alert">{{ loadError }}</p>

    <section v-if="ownerAuthenticated && profile" class="settings-view__section" aria-labelledby="site-profile-title">
      <div class="settings-view__section-heading">
        <h1 id="site-profile-title">公开资料</h1>
        <p>这些内容会展示在公开记录页和内容详情中</p>
      </div>

      <p v-if="visibleError" class="notice notice--error" role="alert">{{ visibleError }}</p>

      <div class="profile-preview" aria-label="公开资料预览">
        <img v-if="previewAvatarUrl" class="profile-preview__avatar" :src="previewAvatarUrl" alt="">
        <div class="profile-preview__copy">
          <strong>小明同学</strong>
          <p v-if="normalizedDraftBio">{{ normalizedDraftBio }}</p>
        </div>
      </div>

      <form class="settings-view__form" @submit.prevent="save">
        <div class="avatar-field">
          <span class="field__label">头像</span>
          <div class="avatar-field__control">
            <img v-if="previewAvatarUrl" class="avatar-field__preview" :src="previewAvatarUrl" alt="头像预览">
            <div class="avatar-field__copy">
              <button
                class="button button--quiet"
                type="button"
                :disabled="submitting"
                @click="chooseAvatar"
              >
                选择图片
              </button>
              <span>支持 JPEG、PNG、WebP，单张不超过 5 MB</span>
            </div>
          </div>
        </div>

        <label class="field">
          <span class="field__label">Bio</span>
          <textarea
            v-model="draftBio"
            rows="4"
            :disabled="submitting"
            :aria-invalid="validationError !== null"
          />
          <span class="settings-view__counter" :class="{ 'settings-view__counter--invalid': validationError }">
            {{ bioLength }} / {{ MAX_BIO_LENGTH }}
          </span>
        </label>

        <div class="settings-view__actions">
          <button
            class="button button--primary"
            type="submit"
            :disabled="!canSubmit"
            :aria-busy="submitting"
          >
            <JournalLoading v-if="submitting" variant="inline" label="保存中…" />
            <template v-else>保存修改</template>
          </button>
        </div>
      </form>
    </section>

    <div v-else-if="waitingForAccess" class="settings-view__loading">
      <JournalLoading
        variant="reading"
        :label="authenticationChecked ? '正在读取公开资料…' : '正在确认管理会话…'"
      />
    </div>
  </main>
</template>

<style scoped>
.settings-view {
  display: grid;
  gap: 1rem;
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-width));
  margin: 0 auto;
  padding: 1.3rem 0 4rem;
}

.settings-view__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.settings-view__section,
.settings-view__form,
.settings-view__section-heading {
  display: grid;
}

.settings-view__section {
  gap: 1.25rem;
}

.settings-view__section-heading {
  gap: 0.25rem;
}

.settings-view__section-heading h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.35rem;
}

.settings-view__section-heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.profile-preview {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.9rem;
  padding: 1.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.profile-preview__avatar {
  display: block;
  width: 3rem;
  height: 3rem;
  flex: none;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
  object-fit: cover;
}

.profile-preview__copy {
  display: grid;
  min-width: 0;
  gap: 0.14rem;
  font-family: var(--font-serif);
}

.profile-preview__copy strong {
  font-size: 1.05rem;
  letter-spacing: 0.02em;
}

.profile-preview__copy p {
  margin: 0;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-view__form {
  gap: 1rem;
}

.avatar-field {
  display: grid;
  gap: 0.4rem;
}

.avatar-field__control {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.avatar-field__preview {
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  flex: none;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
  object-fit: cover;
}

.avatar-field__copy {
  display: grid;
  justify-items: start;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.settings-view__form textarea {
  width: 100%;
  min-height: 7.5rem;
  resize: vertical;
  line-height: 1.7;
}

.settings-view__counter {
  justify-self: end;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.settings-view__counter--invalid {
  color: var(--danger);
}

.settings-view__actions {
  display: flex;
  justify-content: flex-end;
}

.settings-view__loading {
  min-height: 50vh;
}

@media (max-width: 599px) {
  .profile-preview {
    padding: 1rem;
  }

  .avatar-field__control {
    align-items: flex-start;
  }

  .avatar-field__preview {
    width: 4rem;
    height: 4rem;
  }
}
</style>
