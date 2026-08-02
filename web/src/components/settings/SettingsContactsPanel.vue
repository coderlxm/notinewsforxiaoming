<script setup lang="ts">
import { ElSwitch } from 'element-plus';
import 'element-plus/es/components/switch/style/css';
import type { SiteContactItem } from '../../types';

const props = defineProps<{
  contactItems: SiteContactItem[];
  disabled: boolean;
  maxValueLength: number;
  maxUrlLength: number;
}>();

const emit = defineEmits<{
  'update:contactItems': [contactItems: SiteContactItem[]];
}>();

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

type ContactPatch = Partial<Pick<SiteContactItem, 'enabled' | 'value' | 'url'>>;

function updateContact(kind: SiteContactItem['kind'], patch: ContactPatch): void {
  emit('update:contactItems', props.contactItems.map(item =>
    item.kind === kind ? { ...item, ...patch } : item,
  ));
}

function updateEnabled(kind: SiteContactItem['kind'], enabled: boolean | string | number): void {
  updateContact(kind, { enabled: Boolean(enabled) });
}

function updateText(
  kind: SiteContactItem['kind'],
  field: 'value' | 'url',
  event: Event,
): void {
  updateContact(kind, { [field]: (event.target as HTMLInputElement).value });
}
</script>

<template>
  <section class="contacts-panel" aria-labelledby="contact-settings-title">
    <div class="contacts-panel__heading">
      <h2 id="contact-settings-title">联系方式</h2>
      <p>启用后会公开展示在「关于我」页面，保存前请确认内容和链接。</p>
    </div>

    <div class="contacts-panel__grid">
      <article
        v-for="item in props.contactItems"
        :key="item.kind"
        class="contact-card"
      >
        <div class="contact-card__heading">
          <div class="contact-card__copy">
            <h3>{{ item.label }}</h3>
            <p>{{ contactMetadata[item.kind].description }}</p>
          </div>
          <ElSwitch
            class="contact-card__switch"
            :model-value="item.enabled"
            :disabled="props.disabled"
            :aria-label="`${item.enabled ? '关闭' : '启用'}${item.label}`"
            @update:model-value="updateEnabled(item.kind, $event)"
          />
        </div>

        <div class="contact-card__fields">
          <label class="field">
            <span class="field__label">展示内容</span>
            <input
              :value="item.value"
              type="text"
              :maxlength="props.maxValueLength"
              :required="item.enabled"
              :disabled="props.disabled"
              :aria-invalid="item.enabled && !item.value.trim()"
              :placeholder="contactMetadata[item.kind].valuePlaceholder"
              @input="updateText(item.kind, 'value', $event)"
            >
          </label>

          <label v-if="item.kind !== 'wechat'" class="field">
            <span class="field__label">跳转链接</span>
            <input
              :value="item.url ?? ''"
              type="url"
              :maxlength="props.maxUrlLength"
              :required="item.enabled"
              :disabled="props.disabled"
              :aria-invalid="item.enabled && !item.url?.trim()"
              :placeholder="contactMetadata[item.kind].urlPlaceholder ?? ''"
              @input="updateText(item.kind, 'url', $event)"
            >
          </label>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.contacts-panel,
.contacts-panel__heading,
.contact-card,
.contact-card__copy,
.contact-card__fields {
  display: grid;
}

.contacts-panel {
  gap: 1.1rem;
}

.contacts-panel__heading {
  gap: 0.25rem;
}

.contacts-panel__heading h2,
.contact-card__copy h3 {
  margin: 0;
}

.contacts-panel__heading h2 {
  font-family: var(--font-serif);
  font-size: 1.1rem;
}

.contacts-panel__heading p,
.contact-card__copy p {
  margin: 0;
  color: var(--text-muted);
}

.contacts-panel__heading p {
  font-size: 0.75rem;
}

.contacts-panel__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.contact-card {
  min-width: 0;
  align-content: start;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  background: var(--surface-page);
}

.contact-card__heading {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.contact-card__copy {
  min-width: 0;
  gap: 0.22rem;
}

.contact-card__copy h3 {
  font-size: 0.86rem;
}

.contact-card__copy p {
  font-size: 0.72rem;
  line-height: 1.5;
}

.contact-card__switch {
  --el-switch-on-color: var(--accent);
  --el-switch-off-color: var(--border-strong);

  flex: none;
}

.contact-card__fields {
  gap: 0.65rem;
}

@media (max-width: 720px) {
  .contacts-panel__grid {
    grid-template-columns: 1fr;
  }

  .contact-card {
    padding: 0.9rem;
  }
}
</style>
