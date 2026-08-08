<script setup lang="ts">
import { useFileDialog, useMediaQuery, useObjectUrl } from '@vueuse/core';
import { ElTabPane, ElTabs } from 'element-plus';
import 'element-plus/es/components/tab-pane/style/css';
import 'element-plus/es/components/tabs/style/css';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminContributionLinkSettings from '../contribution/AdminContributionLinkSettings.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { logout as logoutRequest } from '../../api';
import { useSessionStore } from '../../stores/session';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { ChannelTags, SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';
import SettingsAccountPanel from './SettingsAccountPanel.vue';
import SettingsChannelTagsPanel from './SettingsChannelTagsPanel.vue';
import SettingsContactsPanel from './SettingsContactsPanel.vue';
import SettingsPublicProfilePanel from './SettingsPublicProfilePanel.vue';

const MAX_BIO_LENGTH = 120;
const MAX_ABOUT_INTRO_LENGTH = 1200;
const MAX_CONTACT_VALUE_LENGTH = 120;
const MAX_CONTACT_URL_LENGTH = 500;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const settingsSections = [
  { name: 'profile', label: '公开资料' },
  { name: 'contacts', label: '联系方式' },
  { name: 'tags', label: '频道标签' },
  { name: 'contribution', label: '投稿链接' },
  { name: 'account', label: '账户' },
] as const;

type SettingsSection = typeof settingsSections[number]['name'];

const route = useRoute();
const router = useRouter();
const compactSettings = useMediaQuery('(max-width: 799px)');
const session = useSessionStore();
const siteProfile = useSiteProfileStore();
const {
  ownerAuthenticated,
  authenticationChecked,
  authenticationError,
} = storeToRefs(session);
const { profile, loading, loadError } = storeToRefs(siteProfile);
const draftBio = shallowRef('');
const draftAboutIntro = shallowRef('');
const draftAvatarFile = shallowRef<File | null>(null);
const draftChannelTags = shallowRef<ChannelTags | null>(null);
const draftContactItems = shallowRef<SiteContactItem[]>([]);
const formError = shallowRef<string | null>(null);
const submitting = shallowRef(false);
const loggingOut = shallowRef(false);
const initialized = shallowRef(false);
let persistentMessage: ReturnType<typeof showMessage> | null = null;
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

const activeSection = computed<SettingsSection>(() => {
  const requestedSection = route.query.section;
  return settingsSections.some(section => section.name === requestedSection)
    ? requestedSection as SettingsSection
    : 'profile';
});
const tabPosition = computed(() => compactSettings.value ? 'top' : 'left');
const normalizedDraftBio = computed(() => draftBio.value.trim());
const normalizedDraftAboutIntro = computed(() => draftAboutIntro.value.trim());
const bioLength = computed(() => normalizedDraftBio.value.length);
const aboutIntroLength = computed(() => normalizedDraftAboutIntro.value.length);
const previewAvatarUrl = computed(() =>
  draftAvatarPreviewUrl.value ?? profile.value?.avatarUrl ?? null,
);
const editableChannelTags = computed<ChannelTags>({
  get: () => draftChannelTags.value ?? profile.value!.channelTags,
  set: value => draftChannelTags.value = value,
});
const incompleteContact = computed(() => draftContactItems.value.find(item =>
  item.enabled
  && (!item.value.trim() || (item.kind !== 'wechat' && !item.url?.trim())),
));
const validationError = computed(() => {
  if (bioLength.value > MAX_BIO_LENGTH) return `Bio 不能超过 ${MAX_BIO_LENGTH} 个字符。`;
  if (aboutIntroLength.value > MAX_ABOUT_INTRO_LENGTH) {
    return `自我介绍不能超过 ${MAX_ABOUT_INTRO_LENGTH} 个字符。`;
  }
  if (incompleteContact.value) {
    return `${incompleteContact.value.label}已启用，请补充完整的展示内容和跳转链接。`;
  }
  return null;
});
const profileDirty = computed(() => profile.value !== null && (
  draftAvatarFile.value !== null
  || normalizedDraftBio.value !== profile.value.bio.trim()
  || normalizedDraftAboutIntro.value !== profile.value.aboutIntro.trim()
));
const contactsDirty = computed(() => profile.value !== null
  && JSON.stringify(draftContactItems.value) !== JSON.stringify(profile.value.contactItems));
const tagsDirty = computed(() => profile.value !== null
  && JSON.stringify(editableChannelTags.value) !== JSON.stringify(profile.value.channelTags));
const hasUnsavedChanges = computed(() => profileDirty.value || contactsDirty.value || tagsDirty.value);
const accessError = computed(() => authenticationError.value
  ?? (authenticationChecked.value && !ownerAuthenticated.value
    ? '请先返回“我的资产”登录后再修改公开资料。'
    : loadError.value));
const accessMessage = computed(() => authenticationError.value
  ?? (authenticationChecked.value && !ownerAuthenticated.value
    ? '请先返回“我的资产”登录后再修改公开资料。'
    : null));
const waitingForAccess = computed(() => accessError.value === null && (
  !authenticationChecked.value
  || (ownerAuthenticated.value && loading.value)
));
const canSubmit = computed(() =>
  ownerAuthenticated.value
  && profile.value !== null
  && !submitting.value
  && validationError.value === null
  && hasUnsavedChanges.value,
);

watch(profile, (value) => {
  if (!value || initialized.value) return;
  draftBio.value = value.bio;
  draftAboutIntro.value = value.aboutIntro;
  draftContactItems.value = value.contactItems.map(item => ({ ...item }));
  initialized.value = true;
}, { immediate: true });

function showPersistentMessage(message: string): void {
  persistentMessage?.close();
  persistentMessage = showMessage({ message, type: 'error', duration: 0 });
}

watch(accessMessage, (error) => {
  if (error) showPersistentMessage(error);
  else {
    persistentMessage?.close();
    persistentMessage = null;
  }
}, { immediate: true });

watch(formError, (error) => {
  if (error) showMessage({ message: error, type: 'error' });
});

watch(validationError, (error, previousError) => {
  if (error && error !== previousError) showMessage({ message: error, type: 'error' });
});

onBeforeUnmount(() => persistentMessage?.close());

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

function selectSection(section: string | number): void {
  if (!settingsSections.some(item => item.name === section)) return;
  const query = { ...route.query };
  if (section === 'profile') delete query.section;
  else query.section = section;
  void router.replace({ query });
}

function replaceContactItems(contactItems: SiteContactItem[]): void {
  draftContactItems.value = contactItems;
}

function sectionIsDirty(section: SettingsSection): boolean {
  if (section === 'profile') return profileDirty.value;
  if (section === 'contacts') return contactsDirty.value;
  if (section === 'tags') return tagsDirty.value;
  return false;
}

async function save(): Promise<void> {
  if (!canSubmit.value) return;
  formError.value = null;
  submitting.value = true;
  try {
    const updated = await siteProfile.update({
      bio: normalizedDraftBio.value,
      avatar: draftAvatarFile.value,
      weatherEnabled: profile.value!.weatherEnabled,
      channelTags: editableChannelTags.value,
      aboutIntro: normalizedDraftAboutIntro.value,
      contactItems: draftContactItems.value.map(item => ({
        ...item,
        value: item.value.trim(),
        url: item.url?.trim() || null,
      })),
    });
    draftBio.value = updated.bio;
    draftAboutIntro.value = updated.aboutIntro;
    draftContactItems.value = updated.contactItems.map(item => ({ ...item }));
    draftAvatarFile.value = null;
    draftChannelTags.value = null;
    resetFileDialog();
    showMessage({ message: '站点设置已保存。', type: 'success' });
  }
  catch (reason) {
    formError.value = reason instanceof Error ? reason.message : String(reason);
  }
  finally {
    submitting.value = false;
  }
}

async function logout(): Promise<void> {
  loggingOut.value = true;
  formError.value = null;
  try {
    await logoutRequest();
    session.setAuthenticated(false);
    await router.replace({ name: 'private' });
  }
  catch (reason) {
    formError.value = reason instanceof Error ? reason.message : String(reason);
  }
  finally {
    loggingOut.value = false;
  }
}
</script>

<template>
  <main class="settings-view">
    <div class="settings-view__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span>设置</span>
    </div>

    <section v-if="ownerAuthenticated && profile" class="settings-workspace" aria-labelledby="site-settings-title">
      <div class="settings-workspace__heading">
        <h1 id="site-settings-title">站点设置</h1>
        <p>分区管理公开资料、联系方式与页面内容。</p>
      </div>

      <form class="settings-workspace__form" @submit.prevent="save">
        <ElTabs
          :model-value="activeSection"
          class="settings-tabs"
          :tab-position="tabPosition"
          :stretch="compactSettings"
          @update:model-value="selectSection"
        >
          <ElTabPane
            v-for="section in settingsSections"
            :key="section.name"
            :name="section.name"
          >
            <template #label>
              <span class="settings-tabs__label">
                {{ section.label }}
                <span
                  v-if="sectionIsDirty(section.name)"
                  class="settings-tabs__dirty"
                  aria-label="有未保存修改"
                />
              </span>
            </template>

            <SettingsPublicProfilePanel
              v-if="section.name === 'profile'"
              v-model:bio="draftBio"
              v-model:about-intro="draftAboutIntro"
              :avatar-url="previewAvatarUrl"
              :disabled="submitting"
              :max-bio-length="MAX_BIO_LENGTH"
              :max-about-intro-length="MAX_ABOUT_INTRO_LENGTH"
              @choose-avatar="chooseAvatar"
            />
            <SettingsContactsPanel
              v-else-if="section.name === 'contacts'"
              :contact-items="draftContactItems"
              :disabled="submitting"
              :max-value-length="MAX_CONTACT_VALUE_LENGTH"
              :max-url-length="MAX_CONTACT_URL_LENGTH"
              @update:contact-items="replaceContactItems"
            />
            <SettingsChannelTagsPanel
              v-else-if="section.name === 'tags'"
              v-model="editableChannelTags"
              :disabled="submitting"
            />
            <AdminContributionLinkSettings v-else-if="section.name === 'contribution'" />
            <SettingsAccountPanel
              v-else
              :logging-out="loggingOut"
              @logout="logout"
            />
          </ElTabPane>
        </ElTabs>

        <div
          v-if="activeSection !== 'contribution' && activeSection !== 'account'"
          class="settings-savebar"
        >
          <p aria-live="polite">
            {{ hasUnsavedChanges ? '有尚未保存的站点设置' : '当前设置已保存' }}
          </p>
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
  width: min(calc(100% - (var(--page-gutter) * 2)), var(--editor-workspace-width));
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

.settings-workspace,
.settings-workspace__heading,
.settings-workspace__form {
  display: grid;
}

.settings-workspace {
  gap: 1.1rem;
}

.settings-workspace__heading {
  gap: 0.25rem;
}

.settings-workspace__heading h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.4rem;
}

.settings-workspace__heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.settings-workspace__form {
  min-width: 0;
  gap: 1rem;
}

.settings-tabs {
  --el-color-primary: var(--accent);
  --el-text-color-primary: var(--text-primary);
  --el-text-color-regular: var(--text-muted);

  min-width: 0;
}

.settings-tabs :deep(.el-tabs__header.is-left) {
  position: sticky;
  top: 1rem;
  align-self: flex-start;
  width: 11.5rem;
  margin-right: 1.4rem;
}

.settings-tabs :deep(.el-tabs__nav-wrap.is-left),
.settings-tabs :deep(.el-tabs__nav-scroll),
.settings-tabs :deep(.el-tabs__nav.is-left) {
  width: 100%;
}

.settings-tabs :deep(.el-tabs__nav-wrap::after),
.settings-tabs :deep(.el-tabs__active-bar) {
  display: none;
}

.settings-tabs :deep(.el-tabs__item) {
  height: 2.9rem;
  justify-content: flex-start;
  margin-bottom: 0.25rem;
  padding: 0 0.9rem !important;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 650;
}

.settings-tabs :deep(.el-tabs__item.is-left) {
  width: 100%;
  text-align: left;
}

.settings-tabs :deep(.el-tabs__item:hover) {
  color: var(--text-primary);
}

.settings-tabs :deep(.el-tabs__item.is-active) {
  background: var(--accent-soft);
  color: var(--accent-strong);
}

.settings-tabs :deep(.el-tabs__content) {
  min-width: 0;
  overflow: visible;
}

.settings-tabs__label {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.settings-tabs__dirty {
  width: 0.38rem;
  height: 0.38rem;
  border-radius: 50%;
  background: currentColor;
}

.settings-savebar {
  position: sticky;
  bottom: 0.75rem;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-left: 12.9rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: color-mix(in srgb, var(--surface-page) 92%, transparent);
  box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, var(--ink) 8%, transparent);
  backdrop-filter: blur(12px);
}

.settings-savebar p {
  margin: 0 auto 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.settings-view__loading {
  min-height: 50vh;
}

@media (max-width: 799px) {
  .settings-view {
    padding-top: 0.8rem;
  }

  .settings-tabs :deep(.el-tabs__header.is-top) {
    position: sticky;
    top: 0;
    z-index: 4;
    margin: 0 0 1rem;
    padding: 0.35rem 0;
    background: var(--surface-page);
  }

  .settings-tabs :deep(.el-tabs__nav-wrap) {
    overflow-x: auto;
    scrollbar-width: none;
  }

  .settings-tabs :deep(.el-tabs__nav-wrap::-webkit-scrollbar) {
    display: none;
  }

  .settings-tabs :deep(.el-tabs__nav-scroll) {
    overflow: visible;
  }

  .settings-tabs :deep(.el-tabs__nav) {
    min-width: max-content;
  }

  .settings-tabs :deep(.el-tabs__item) {
    height: 2.7rem;
    justify-content: center;
    margin: 0;
    padding: 0 0.8rem !important;
    font-size: 0.76rem;
  }

  .settings-savebar {
    bottom: calc(var(--mobile-bottom-nav-height, 0px) + 0.65rem);
    margin-left: 0;
  }
}

@media (max-width: 520px) {
  .settings-workspace__heading p {
    max-width: 24rem;
  }

  .settings-savebar p {
    display: none;
  }

  .settings-savebar .button {
    width: 100%;
  }
}
</style>
