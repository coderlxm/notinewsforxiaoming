<script setup lang="ts">
import { useFileDialog, useObjectUrl } from '@vueuse/core';
import { ElSwitch } from 'element-plus';
import 'element-plus/es/components/switch/style/css';
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, reactive, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import AdminContributionLinkSettings from '../contribution/AdminContributionLinkSettings.vue';
import JournalLoading from '../ui/JournalLoading.vue';
import { useSessionStore } from '../../stores/session';
import { useSiteProfileStore } from '../../stores/siteProfile';
import type { ChannelTags, JournalChannel, SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';

const MAX_BIO_LENGTH = 120;
const MAX_ABOUT_INTRO_LENGTH = 1200;
const MAX_CONTACT_VALUE_LENGTH = 120;
const MAX_CONTACT_URL_LENGTH = 500;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_CHANNEL_TAGS = 8;
const MAX_CHANNEL_TAG_LENGTH = 32;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type ChannelTagKey = JournalChannel;

const channelTagGroups: Array<{ key: ChannelTagKey; label: string }> = [
  { key: 'life', label: '生活' },
  { key: 'article', label: '文章' },
  { key: 'interest', label: '兴趣' },
];

const contactMetadata: Record<SiteContactItem['kind'], {
  description: string;
  valuePlaceholder: string;
  urlPlaceholder: string | null;
}> = {
  telegram: {
    description: '公开 Telegram 用户名',
    valuePlaceholder: '@xiaoming',
    urlPlaceholder: 'https://t.me/xiaoming',
  },
  email: {
    description: '公开邮箱并支持访客复制',
    valuePlaceholder: 'name@example.com',
    urlPlaceholder: 'mailto:name@example.com',
  },
  wechat: {
    description: '公开微信号，访客点击后复制',
    valuePlaceholder: '微信号',
    urlPlaceholder: null,
  },
  github: {
    description: '公开 GitHub 主页',
    valuePlaceholder: 'github.com/xiaoming',
    urlPlaceholder: 'https://github.com/xiaoming',
  },
  website: {
    description: '公开个人网站或其他个人链接',
    valuePlaceholder: 'example.com',
    urlPlaceholder: 'https://example.com',
  },
};

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
const draftAboutIntro = shallowRef('');
const draftAvatarFile = shallowRef<File | null>(null);
const draftChannelTags = shallowRef<ChannelTags | null>(null);
const draftContactItems = reactive<SiteContactItem[]>([]);
const draftTagInputs = reactive<Record<ChannelTagKey, string>>({
  life: '',
  article: '',
  interest: '',
});
const formError = shallowRef<string | null>(null);
const submitting = shallowRef(false);
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

const normalizedDraftBio = computed(() => draftBio.value.trim());
const normalizedDraftAboutIntro = computed(() => draftAboutIntro.value.trim());
const bioLength = computed(() => normalizedDraftBio.value.length);
const aboutIntroLength = computed(() => normalizedDraftAboutIntro.value.length);
const previewAvatarUrl = computed(() =>
  draftAvatarPreviewUrl.value ?? profile.value?.avatarUrl ?? null,
);
const incompleteContact = computed(() => draftContactItems.find(item =>
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
  && validationError.value === null,
);

watch(profile, (value) => {
  if (!value || initialized.value) return;
  draftBio.value = value.bio;
  draftAboutIntro.value = value.aboutIntro;
  draftContactItems.splice(0, draftContactItems.length, ...value.contactItems.map(item => ({ ...item })));
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

function editableChannelTags(): ChannelTags {
  if (draftChannelTags.value !== null) return draftChannelTags.value;
  return profile.value!.channelTags;
}

function replaceChannelTags(channel: ChannelTagKey, tags: string[]): void {
  const current = editableChannelTags();
  draftChannelTags.value = {
    ...current,
    [channel]: tags,
  };
}

function addChannelTag(channel: ChannelTagKey): void {
  const tag = draftTagInputs[channel].trim();
  if (!tag) return;
  if (tag.includes('#')) {
    showMessage({ message: '标签名称不需要输入 #。', type: 'error' });
    return;
  }
  if (tag === '全部') {
    showMessage({ message: '“全部”是固定入口，不需要配置。', type: 'error' });
    return;
  }

  const tags = editableChannelTags()[channel];
  if (tags.includes(tag)) {
    showMessage({ message: `“${tag}”已经在当前频道中。`, type: 'error' });
    return;
  }
  if (tags.length >= MAX_CHANNEL_TAGS) {
    showMessage({ message: `每个频道最多配置 ${MAX_CHANNEL_TAGS} 个标签。`, type: 'error' });
    return;
  }

  replaceChannelTags(channel, [...tags, tag]);
  draftTagInputs[channel] = '';
}

function removeChannelTag(channel: ChannelTagKey, index: number): void {
  replaceChannelTags(channel, editableChannelTags()[channel].filter((_, itemIndex) => itemIndex !== index));
}

function moveChannelTag(channel: ChannelTagKey, index: number, offset: -1 | 1): void {
  const tags = [...editableChannelTags()[channel]];
  const targetIndex = index + offset;
  [tags[index], tags[targetIndex]] = [tags[targetIndex]!, tags[index]!];
  replaceChannelTags(channel, tags);
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
      channelTags: editableChannelTags(),
      aboutIntro: normalizedDraftAboutIntro.value,
      contactItems: draftContactItems.map(item => ({
        ...item,
        value: item.value.trim(),
        url: item.url?.trim() || null,
      })),
    });
    draftBio.value = updated.bio;
    draftAboutIntro.value = updated.aboutIntro;
    draftContactItems.splice(0, draftContactItems.length, ...updated.contactItems.map(item => ({ ...item })));
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
</script>

<template>
  <main class="settings-view">
    <div class="settings-view__heading">
      <button class="text-button" type="button" @click="router.push({ name: 'private' })">← 返回我的资产</button>
      <span>设置</span>
    </div>

    <section v-if="ownerAuthenticated && profile" class="settings-view__section" aria-labelledby="site-profile-title">
      <div class="settings-view__section-heading">
        <h1 id="site-profile-title">站点设置</h1>
        <p>管理公开资料与页面展示内容</p>
      </div>

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
            :aria-invalid="bioLength > MAX_BIO_LENGTH"
          />
          <span class="settings-view__counter" :class="{ 'settings-view__counter--invalid': bioLength > MAX_BIO_LENGTH }">
            {{ bioLength }} / {{ MAX_BIO_LENGTH }}
          </span>
        </label>

        <label class="field">
          <span class="field__label">关于我的自我介绍</span>
          <textarea
            v-model="draftAboutIntro"
            rows="7"
            :maxlength="MAX_ABOUT_INTRO_LENGTH"
            :disabled="submitting"
            :aria-invalid="validationError?.startsWith('自我介绍')"
            placeholder="补充一段比 Bio 更完整的自我介绍"
          />
          <span class="settings-view__counter" :class="{ 'settings-view__counter--invalid': aboutIntroLength > MAX_ABOUT_INTRO_LENGTH }">
            {{ aboutIntroLength }} / {{ MAX_ABOUT_INTRO_LENGTH }}
          </span>
        </label>

        <section class="contact-settings" aria-labelledby="contact-settings-title">
          <div class="contact-settings__heading">
            <h2 id="contact-settings-title">联系方式</h2>
            <p>启用后会公开展示在「关于我」页面，保存前请确认内容和链接。</p>
          </div>

          <div class="contact-settings__list">
            <article
              v-for="item in draftContactItems"
              :key="item.kind"
              class="contact-settings__item"
            >
              <div class="contact-settings__item-heading">
                <div>
                  <h3>{{ item.label }}</h3>
                  <p>{{ contactMetadata[item.kind].description }}</p>
                </div>
                <ElSwitch
                  v-model="item.enabled"
                  class="contact-settings__switch"
                  :disabled="submitting"
                  :aria-label="`${item.enabled ? '关闭' : '启用'}${item.label}`"
                />
              </div>

              <div
                class="contact-settings__fields"
                :class="{ 'contact-settings__fields--single': item.kind === 'wechat' }"
              >
                <label class="field">
                  <span class="field__label">展示内容</span>
                  <input
                    v-model="item.value"
                    type="text"
                    :maxlength="MAX_CONTACT_VALUE_LENGTH"
                    :required="item.enabled"
                    :disabled="submitting"
                    :aria-invalid="item.enabled && !item.value.trim()"
                    :placeholder="contactMetadata[item.kind].valuePlaceholder"
                  >
                </label>

                <label v-if="item.kind !== 'wechat'" class="field">
                  <span class="field__label">跳转链接</span>
                  <input
                    v-model="item.url"
                    type="url"
                    :maxlength="MAX_CONTACT_URL_LENGTH"
                    :required="item.enabled"
                    :disabled="submitting"
                    :aria-invalid="item.enabled && !item.url?.trim()"
                    :placeholder="contactMetadata[item.kind].urlPlaceholder ?? ''"
                  >
                </label>
              </div>
            </article>
          </div>
        </section>

        <section class="channel-tags" aria-labelledby="channel-tags-title">
          <div class="channel-tags__heading">
            <div>
              <h2 id="channel-tags-title">频道标签</h2>
              <p>编排公开信息流的常驻标签及展示顺序，每个频道最多 {{ MAX_CHANNEL_TAGS }} 个。</p>
            </div>
          </div>

          <div class="channel-tags__groups">
            <section
              v-for="group in channelTagGroups"
              :key="group.key"
              class="channel-tags__group"
              :aria-labelledby="`channel-tags-${group.key}`"
            >
              <div class="channel-tags__group-heading">
                <h3 :id="`channel-tags-${group.key}`">{{ group.label }}</h3>
                <span>{{ editableChannelTags()[group.key].length }} / {{ MAX_CHANNEL_TAGS }}</span>
              </div>

              <div class="channel-tags__input-row">
                <input
                  v-model="draftTagInputs[group.key]"
                  type="text"
                  :maxlength="MAX_CHANNEL_TAG_LENGTH"
                  :placeholder="`添加${group.label}标签`"
                  :aria-label="`添加${group.label}标签`"
                  :disabled="submitting || editableChannelTags()[group.key].length >= MAX_CHANNEL_TAGS"
                  @keydown.enter.prevent="addChannelTag(group.key)"
                >
                <button
                  class="button button--quiet"
                  type="button"
                  :disabled="submitting || editableChannelTags()[group.key].length >= MAX_CHANNEL_TAGS"
                  @click="addChannelTag(group.key)"
                >
                  添加
                </button>
              </div>

              <ol v-if="editableChannelTags()[group.key].length" class="channel-tags__list">
                <li
                  v-for="(tag, index) in editableChannelTags()[group.key]"
                  :key="tag"
                  class="channel-tags__item"
                >
                  <span>{{ tag }}</span>
                  <div class="channel-tags__item-actions">
                    <button
                      type="button"
                      :aria-label="`向前移动${tag}`"
                      :disabled="submitting || index === 0"
                      @click="moveChannelTag(group.key, index, -1)"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      :aria-label="`向后移动${tag}`"
                      :disabled="submitting || index === editableChannelTags()[group.key].length - 1"
                      @click="moveChannelTag(group.key, index, 1)"
                    >
                      →
                    </button>
                    <button
                      class="channel-tags__remove"
                      type="button"
                      :aria-label="`删除${tag}`"
                      :disabled="submitting"
                      @click="removeChannelTag(group.key, index)"
                    >
                      删除
                    </button>
                  </div>
                </li>
              </ol>
              <p v-else class="channel-tags__empty">暂未配置常驻标签</p>
            </section>
          </div>
        </section>

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

      <AdminContributionLinkSettings />
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

.contact-settings {
  display: grid;
  gap: 0.8rem;
  padding-top: 0.3rem;
}

.contact-settings__heading h2,
.contact-settings__item-heading h3 {
  margin: 0;
}

.contact-settings__heading h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
}

.contact-settings__heading p,
.contact-settings__item-heading p {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.contact-settings__list {
  display: grid;
  gap: 0.65rem;
}

.contact-settings__item {
  display: grid;
  grid-template-columns: minmax(10rem, 0.42fr) minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.contact-settings__item-heading {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.contact-settings__item-heading h3 {
  font-size: 0.82rem;
}

.contact-settings__switch {
  --el-switch-on-color: var(--accent);
  --el-switch-off-color: var(--border-strong);

  flex: none;
}

.contact-settings__fields {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
  gap: 0.65rem;
}

.contact-settings__fields--single {
  grid-template-columns: 1fr;
}

.channel-tags {
  display: grid;
  gap: 0.8rem;
  padding-top: 0.3rem;
}

.channel-tags__heading h2,
.channel-tags__group-heading h3 {
  margin: 0;
}

.channel-tags__heading h2 {
  font-family: var(--font-serif);
  font-size: 1rem;
}

.channel-tags__heading p {
  margin: 0.2rem 0 0;
  color: var(--text-muted);
  font-size: 0.72rem;
}

.channel-tags__groups {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.channel-tags__group {
  display: grid;
  align-content: start;
  gap: 0.65rem;
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.channel-tags__group-heading,
.channel-tags__input-row,
.channel-tags__item,
.channel-tags__item-actions {
  display: flex;
  align-items: center;
}

.channel-tags__group-heading {
  justify-content: space-between;
  gap: 0.5rem;
}

.channel-tags__group-heading h3 {
  font-size: 0.82rem;
}

.channel-tags__group-heading span,
.channel-tags__empty {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.channel-tags__input-row {
  gap: 0.4rem;
}

.channel-tags__input-row input {
  width: 100%;
}

.channel-tags__input-row .button {
  flex: none;
}

.channel-tags__list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.channel-tags__item {
  justify-content: space-between;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.45rem 0.55rem;
  border-radius: 8px;
  background: var(--surface-card);
}

.channel-tags__item > span {
  overflow: hidden;
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.channel-tags__item-actions {
  flex: none;
  gap: 0.2rem;
}

.channel-tags__item-actions button {
  min-width: 1.7rem;
  min-height: 1.7rem;
  padding: 0 0.35rem;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.68rem;
}

.channel-tags__item-actions button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.channel-tags__item-actions button:disabled {
  cursor: default;
  opacity: 0.35;
}

.channel-tags__item-actions .channel-tags__remove {
  color: var(--danger);
}

.channel-tags__empty {
  margin: 0;
  padding: 0.45rem 0;
  text-align: center;
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

  .channel-tags__groups {
    grid-template-columns: 1fr;
  }

  .contact-settings__item,
  .contact-settings__fields {
    grid-template-columns: 1fr;
  }
}

@media (min-width: 600px) and (max-width: 900px) {
  .contact-settings__item {
    grid-template-columns: 1fr;
  }

  .channel-tags__groups {
    grid-template-columns: 1fr;
  }
}
</style>
