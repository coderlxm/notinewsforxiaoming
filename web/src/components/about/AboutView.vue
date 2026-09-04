<script setup lang="ts" name="AboutView">
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useSiteProfileStore } from '../../stores/siteProfile';
import AboutContactList from './AboutContactList.vue';
import AboutResumeCard from './AboutResumeCard.vue';

const siteProfile = useSiteProfileStore();
const { profile, loadError } = storeToRefs(siteProfile);
const visibleContacts = computed(() =>
  profile.value?.contactItems.filter((contact) => contact.enabled && contact.value.trim()) ?? [],
);
</script>

<template>
  <main class="about-view">
    <div v-if="profile" class="about-view__content">
      <section class="about-view__identity" aria-labelledby="about-title">
        <img class="about-view__avatar" :src="profile.avatarUrl" alt="小明同学">
        <div class="about-view__identity-copy">
          <p class="about-view__eyebrow">关于我</p>
          <h1 id="about-title" class="about-view__title">小明同学</h1>
          <p v-if="profile.bio" class="about-view__bio">{{ profile.bio }}</p>
        </div>
      </section>

      <section v-if="profile.aboutIntro" class="about-view__section" aria-labelledby="about-intro-title">
        <h2 id="about-intro-title" class="about-view__section-title">你好</h2>
        <p class="about-view__introduction">{{ profile.aboutIntro }}</p>
      </section>

      <section v-if="profile.resume" class="about-view__section" aria-label="个人简历">
        <AboutResumeCard :resume="profile.resume" />
      </section>

      <section v-if="visibleContacts.length" class="about-view__section" aria-labelledby="contact-title">
        <h2 id="contact-title" class="about-view__section-title">找到我</h2>
        <AboutContactList :contacts="visibleContacts" />
      </section>
    </div>

    <div
      v-else-if="!loadError"
      class="about-view__skeleton"
      role="status"
      aria-label="正在读取关于我"
    >
      <span class="about-view__skeleton-avatar" />
      <div class="about-view__skeleton-copy">
        <span />
        <span />
        <span />
      </div>
    </div>
  </main>
</template>

<style scoped>
.about-view {
  width: min(calc(100% - (var(--page-gutter) * 2)), 960px);
  margin: 0 auto;
  padding: clamp(2rem, 5vw, 4.5rem) 0 5rem;
}

.about-view__content {
  display: grid;
  gap: clamp(2.4rem, 5vw, 4rem);
}

.about-view__identity {
  display: flex;
  align-items: center;
  gap: 1.4rem;
}

.about-view__avatar,
.about-view__skeleton-avatar {
  width: 5.25rem;
  height: 5.25rem;
  flex: 0 0 auto;
  border-radius: 50%;
}

.about-view__avatar {
  object-fit: cover;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.about-view__identity-copy {
  min-width: 0;
}

.about-view__eyebrow {
  margin: 0 0 0.25rem;
  color: var(--accent-strong);
  font-size: 0.7rem;
  font-weight: 760;
  letter-spacing: 0.18em;
}

.about-view__title,
.about-view__section-title {
  font-family: var(--font-serif);
}

.about-view__title {
  margin: 0;
  font-size: clamp(1.65rem, 3vw, 2.25rem);
  line-height: 1.25;
}

.about-view__bio {
  margin: 0.45rem 0 0;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.92rem;
  line-height: 1.65;
}

.about-view__section {
  display: grid;
  gap: 1rem;
}

.about-view__section-title {
  margin: 0;
  font-size: 1.12rem;
}

.about-view__introduction {
  max-width: var(--reading-width);
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.95;
  white-space: pre-line;
}

.about-view__skeleton {
  display: flex;
  align-items: center;
  gap: 1.4rem;
}

.about-view__skeleton-avatar,
.about-view__skeleton-copy span {
  background: var(--surface-muted);
  animation: about-skeleton-pulse 1.4s ease-in-out infinite;
}

.about-view__skeleton-copy {
  display: grid;
  width: min(22rem, 65%);
  gap: 0.55rem;
}

.about-view__skeleton-copy span {
  height: 0.85rem;
  border-radius: 999px;
}

.about-view__skeleton-copy span:first-child {
  width: 28%;
}

.about-view__skeleton-copy span:nth-child(2) {
  width: 52%;
  height: 1.6rem;
}

.about-view__skeleton-copy span:last-child {
  width: 88%;
}

@keyframes about-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 799px) {
  .about-view {
    padding: 1.5rem 0 3.5rem;
  }

  .about-view__content {
    gap: 2.25rem;
  }

  .about-view__identity,
  .about-view__skeleton {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .about-view__skeleton-avatar,
  .about-view__skeleton-copy span {
    animation: none;
  }
}
</style>
