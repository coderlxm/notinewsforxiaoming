<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  avatarUrl: string | null;
  disabled: boolean;
  maxBioLength: number;
  maxAboutIntroLength: number;
}>();

const emit = defineEmits<{
  chooseAvatar: [];
}>();

const bio = defineModel<string>('bio', { required: true });
const aboutIntro = defineModel<string>('aboutIntro', { required: true });

const normalizedBio = computed(() => bio.value.trim());
const bioLength = computed(() => normalizedBio.value.length);
const aboutIntroLength = computed(() => aboutIntro.value.trim().length);
</script>

<template>
  <section class="profile-panel" aria-labelledby="public-profile-title">
    <div class="profile-panel__heading">
      <h2 id="public-profile-title">公开资料</h2>
      <p>设置站点头像、简短 Bio 和「关于我」页面中的自我介绍。</p>
    </div>

    <div class="profile-panel__layout">
      <div class="profile-panel__editor">
        <div class="avatar-field">
          <span class="field__label">头像</span>
          <div class="avatar-field__control">
            <img v-if="props.avatarUrl" class="avatar-field__preview" :src="props.avatarUrl" alt="头像预览">
            <div class="avatar-field__copy">
              <button
                class="button button--quiet"
                type="button"
                :disabled="props.disabled"
                @click="emit('chooseAvatar')"
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
            v-model="bio"
            rows="4"
            :disabled="props.disabled"
            :aria-invalid="bioLength > props.maxBioLength"
          />
          <span
            class="profile-panel__counter"
            :class="{ 'profile-panel__counter--invalid': bioLength > props.maxBioLength }"
          >
            {{ bioLength }} / {{ props.maxBioLength }}
          </span>
        </label>

        <label class="field">
          <span class="field__label">关于我的自我介绍</span>
          <textarea
            v-model="aboutIntro"
            rows="7"
            :maxlength="props.maxAboutIntroLength"
            :disabled="props.disabled"
            :aria-invalid="aboutIntroLength > props.maxAboutIntroLength"
            placeholder="补充一段比 Bio 更完整的自我介绍"
          />
          <span
            class="profile-panel__counter"
            :class="{ 'profile-panel__counter--invalid': aboutIntroLength > props.maxAboutIntroLength }"
          >
            {{ aboutIntroLength }} / {{ props.maxAboutIntroLength }}
          </span>
        </label>
      </div>

      <aside class="profile-preview" aria-label="公开资料预览">
        <span class="profile-preview__eyebrow">资料预览</span>
        <div class="profile-preview__content">
          <img v-if="props.avatarUrl" class="profile-preview__avatar" :src="props.avatarUrl" alt="">
          <div class="profile-preview__copy">
            <strong>小明同学</strong>
            <p v-if="normalizedBio">{{ normalizedBio }}</p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.profile-panel,
.profile-panel__heading,
.profile-panel__editor {
  display: grid;
}

.profile-panel {
  gap: 1.1rem;
}

.profile-panel__heading {
  gap: 0.25rem;
}

.profile-panel__heading h2 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.profile-panel__heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.75rem;
}

.profile-panel__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.28fr) minmax(15rem, 0.72fr);
  align-items: start;
  gap: 1.25rem;
}

.profile-panel__editor {
  min-width: 0;
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

.profile-panel__editor textarea {
  width: 100%;
  min-height: 7.5rem;
  resize: vertical;
  line-height: 1.7;
}

.profile-panel__counter {
  justify-self: end;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.profile-panel__counter--invalid {
  color: var(--danger);
}

.profile-preview {
  display: grid;
  gap: 1.1rem;
  min-width: 0;
  padding: 1.15rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.profile-preview__eyebrow {
  color: var(--accent-strong);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-preview__content {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.9rem;
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

@media (max-width: 720px) {
  .profile-panel__layout {
    grid-template-columns: 1fr;
  }

  .profile-preview {
    grid-row: 1;
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
