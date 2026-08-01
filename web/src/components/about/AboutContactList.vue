<script setup lang="ts">
import type { SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';

defineProps<{
  contacts: SiteContactItem[];
}>();

function contactUrl(contact: SiteContactItem): string {
  if (contact.url === null) {
    throw new Error(`Contact ${contact.kind} requires a URL.`);
  }
  return contact.url;
}

async function copyContact(contact: SiteContactItem): Promise<void> {
  await navigator.clipboard.writeText(contact.value);
  showMessage({ message: `已复制${contact.label}`, type: 'success' });
}
</script>

<template>
  <div class="contact-list">
    <article
      v-for="contact in contacts"
      :key="contact.kind"
      class="contact-list__item"
    >
      <div class="contact-list__copy">
        <span class="contact-list__label">{{ contact.label }}</span>
        <span class="contact-list__value">{{ contact.value }}</span>
      </div>

      <div v-if="contact.kind === 'email'" class="contact-list__actions">
        <a class="contact-list__action" :href="contactUrl(contact)">写邮件</a>
        <button class="contact-list__action" type="button" @click="copyContact(contact)">复制</button>
      </div>
      <button
        v-else-if="contact.kind === 'wechat'"
        class="contact-list__action"
        type="button"
        @click="copyContact(contact)"
      >
        复制
      </button>
      <a
        v-else
        class="contact-list__action contact-list__action--external"
        :href="contactUrl(contact)"
        target="_blank"
        rel="noopener noreferrer"
      >
        打开
      </a>
    </article>
  </div>
</template>

<style scoped>
.contact-list {
  display: grid;
  gap: 0.55rem;
}

.contact-list__item {
  display: flex;
  min-height: 4.25rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-card) 72%, transparent);
}

.contact-list__copy {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.contact-list__label {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 680;
}

.contact-list__value {
  overflow-wrap: anywhere;
  font-size: 0.86rem;
  font-weight: 650;
}

.contact-list__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.4rem;
}

.contact-list__action {
  display: inline-flex;
  min-height: 2.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0.42rem 0.68rem;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--surface-card);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 680;
  text-decoration: none;
}

.contact-list__action:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border-subtle));
  color: var(--accent-strong);
}

.contact-list__action--external::after {
  margin-left: 0.3rem;
  content: '↗';
}

@media (max-width: 599px) {
  .contact-list__item {
    min-height: 3.85rem;
    padding: 0.72rem 0.78rem;
  }

  .contact-list__action {
    min-height: 2.4rem;
  }
}
</style>
