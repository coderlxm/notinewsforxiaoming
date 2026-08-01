<script setup lang="ts">
import type { SiteContactItem } from '../../types';
import { showMessage } from '../../utils/message';
import AboutContactIcon from './AboutContactIcon.vue';

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
  <ul class="contact-list">
    <li
      v-for="contact in contacts"
      :key="contact.kind"
      class="contact-list__item"
    >
      <div class="contact-list__heading">
        <span class="contact-list__channel">
          <AboutContactIcon class="contact-list__icon" :kind="contact.kind" />
          <span class="contact-list__label">{{ contact.label }}</span>
        </span>
        <button
          v-if="contact.kind === 'email' || contact.kind === 'wechat'"
          class="contact-list__copy-action"
          type="button"
          @click="copyContact(contact)"
        >
          复制
        </button>
      </div>

      <button
        v-if="contact.kind === 'wechat'"
        class="contact-list__link"
        type="button"
        @click="copyContact(contact)"
      >
        <span class="contact-list__value">{{ contact.value }}</span>
      </button>
      <a
        v-else
        class="contact-list__link"
        :href="contactUrl(contact)"
        :target="contact.kind === 'email' ? undefined : '_blank'"
        :rel="contact.kind === 'email' ? undefined : 'noopener noreferrer'"
      >
        <span class="contact-list__value">{{ contact.value }}</span>
        <span v-if="contact.kind !== 'email'" class="contact-list__indicator">↗</span>
      </a>
    </li>
  </ul>
</template>

<style scoped>
.contact-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 1rem;
  margin: 0;
  padding: 0.25rem 0 0;
  list-style: none;
}

.contact-list__item {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 0.34rem;
  padding-left: 0.7rem;
  border-left: 2px solid var(--border-subtle);
  transition: border-color 150ms ease;
}

.contact-list__item:hover,
.contact-list__item:focus-within {
  border-left-color: var(--accent);
}

.contact-list__heading,
.contact-list__channel,
.contact-list__link {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.contact-list__channel {
  justify-content: flex-start;
  gap: 0.38rem;
}

.contact-list__heading {
  min-height: 1.75rem;
}

.contact-list__icon {
  width: 1.05rem;
  height: 1.05rem;
  flex: none;
  color: var(--accent-strong);
}

.contact-list__label {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 720;
  letter-spacing: 0.04em;
}

.contact-list__copy-action {
  min-height: 1.75rem;
  flex: none;
  padding: 0 0.1rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.64rem;
}

.contact-list__copy-action:hover {
  color: var(--accent-strong);
}

.contact-list__link {
  width: 100%;
  min-height: 2.2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  text-decoration: none;
}

.contact-list__link:hover {
  color: var(--accent-strong);
}

.contact-list__value {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 0.8rem;
  font-weight: 650;
  line-height: 1.45;
}

.contact-list__indicator {
  flex: none;
  color: var(--text-muted);
  font-size: 0.66rem;
  font-weight: 650;
}

.contact-list__link:hover .contact-list__indicator {
  color: var(--accent-strong);
}

@media (max-width: 599px) {
  .contact-list {
    gap: 1.15rem 1rem;
  }

  .contact-list__link {
    min-height: 2.4rem;
  }
}
</style>
