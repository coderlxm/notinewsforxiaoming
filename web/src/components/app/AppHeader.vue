<script setup lang="ts">
import { computed, onMounted, onUnmounted, shallowRef, useTemplateRef, watch } from 'vue';
import type { SiteProfile } from '../../types';
import { showMessage } from '../../utils/message';
import PublicSearchBar from '../discovery/PublicSearchBar.vue';
import ThemeModeControl from '../ui/ThemeModeControl.vue';

const props = defineProps<{
  profile: SiteProfile | null;
  profileLoadError: string | null;
  publicMode: boolean;
  showNavigation: boolean;
  publicNavActive: boolean;
  privateContext: boolean;
  assetActive: boolean;
  ownerAuthenticated: boolean;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const profileBio = useTemplateRef<HTMLParagraphElement>('profileBio');
const profileBioOverflow = shallowRef(0);
let profileBioResizeObserver: ResizeObserver | null = null;
let profileErrorMessage: ReturnType<typeof showMessage> | null = null;

const profileBioStyle = computed(() => {
  if (profileBioOverflow.value <= 0) return undefined;
  const duration = Math.max(8, profileBioOverflow.value / 10.8);
  return {
    '--profile-bio-distance': `-${profileBioOverflow.value}px`,
    '--profile-bio-duration': `${duration.toFixed(2)}s`,
  };
});

function measureProfileBio(): void {
  const element = profileBio.value;
  profileBioOverflow.value = element
    ? Math.max(0, element.scrollWidth - element.clientWidth)
    : 0;
}

watch(profileBio, (element, previousElement) => {
  if (!profileBioResizeObserver) return;
  if (previousElement) profileBioResizeObserver.unobserve(previousElement);
  if (element) {
    profileBioResizeObserver.observe(element);
    measureProfileBio();
  }
}, { flush: 'post' });

watch(() => props.profile?.bio, measureProfileBio, { flush: 'post' });

watch(() => props.profileLoadError, (error) => {
  profileErrorMessage?.close();
  profileErrorMessage = error
    ? showMessage({ message: `公开资料加载失败：${error}`, type: 'error', duration: 0 })
    : null;
}, { immediate: true });

onMounted(() => {
  profileBioResizeObserver = new ResizeObserver(measureProfileBio);
  if (profileBio.value) {
    profileBioResizeObserver.observe(profileBio.value);
    measureProfileBio();
  }
});

onUnmounted(() => {
  profileBioResizeObserver?.disconnect();
  profileErrorMessage?.close();
});
</script>

<template>
  <div class="profile-bar">
    <header class="profile" :class="{ 'profile--public': publicMode }">
      <div class="profile__identity">
        <button class="profile__home" type="button" aria-label="返回公开首页" @click="emit('navigate', '/')">
          <img v-if="profile" class="profile__avatar" :src="profile.avatarUrl" alt="小明同学">
          <span
            v-else
            class="profile__avatar-placeholder"
            :class="{ 'profile__avatar-placeholder--error': profileLoadError }"
            aria-hidden="true"
          />
        </button>
        <div class="profile__copy">
          <button class="profile__name" type="button" @click="emit('navigate', '/')">小明同学</button>
          <p
            v-if="profile?.bio"
            ref="profileBio"
            class="profile__bio"
            :class="{ 'profile__bio--scrolling': profileBioOverflow > 0 }"
            :style="profileBioStyle"
          >
            <span class="profile__bio-text">{{ profile.bio }}</span>
          </p>
          <span
            v-else-if="!profile && !profileLoadError"
            class="profile__bio-skeleton"
            role="status"
            aria-label="正在读取公开资料"
          />
        </div>
      </div>
      <div v-if="publicMode" class="profile__search">
        <PublicSearchBar />
      </div>
      <div class="profile__actions">
        <nav v-if="showNavigation" class="profile__nav" aria-label="主导航">
          <button
            v-if="privateContext"
            class="profile__nav-link"
            :class="{ 'profile__nav-link--active': publicNavActive }"
            type="button"
            :aria-current="publicNavActive ? 'page' : undefined"
            @click="emit('navigate', '/')"
          >
            公开记录
          </button>
          <button
            v-if="privateContext || ownerAuthenticated"
            class="profile__nav-link"
            :class="{ 'profile__nav-link--active': assetActive }"
            type="button"
            :aria-current="assetActive ? 'page' : undefined"
            @click="emit('navigate', '/me')"
          >
            我的资产
          </button>
        </nav>
        <ThemeModeControl />
      </div>
    </header>
  </div>
</template>

<style scoped>
.profile-bar {
  display: grid;
  z-index: 20;
  grid-template-rows: 1fr;
  overflow: hidden;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-page);
}

.profile {
  display: grid;
  min-height: 0;
  grid-template-areas: "identity actions";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.9rem;
  width: min(calc(100% - (var(--workspace-gutter) * 2)), var(--workspace-width));
  margin: 0 auto;
  padding: 1.15rem 0 1rem;
}

.profile--public {
  grid-template-areas: "identity search actions";
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 40rem) minmax(0, 1fr);
}

.profile__home,
.profile__name,
.profile__nav-link {
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.profile__home {
  flex: 0 0 auto;
  padding: 0;
  border-radius: 50%;
}

.profile__avatar,
.profile__avatar-placeholder {
  display: block;
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border-strong);
}

.profile__avatar {
  object-fit: cover;
}

.profile__avatar-placeholder,
.profile__bio-skeleton {
  background: var(--surface-muted);
  animation: profile-skeleton-pulse 1.4s ease-in-out infinite;
}

.profile__avatar-placeholder--error {
  background: var(--danger-soft);
  animation: none;
}

.profile__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.9rem;
  grid-area: identity;
}

.profile__copy {
  min-width: 0;
}

.profile__search {
  width: min(100%, 40rem);
  min-width: 0;
  justify-self: center;
  grid-area: search;
}

.profile__name {
  padding: 0;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 750;
  letter-spacing: 0.02em;
}

.profile__bio {
  margin: 0.14rem 0 0;
  overflow: hidden;
  color: var(--text-muted);
  font-family: var(--font-serif);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile__bio--scrolling {
  text-overflow: clip;
  mask-image: linear-gradient(to right, transparent, #000 0.4rem, #000 calc(100% - 0.4rem), transparent);
}

.profile__bio--scrolling .profile__bio-text {
  display: block;
  width: max-content;
  animation: profile-bio-pan var(--profile-bio-duration) linear infinite;
}

.profile__bio-skeleton {
  display: block;
  width: 13.5rem;
  height: 0.74rem;
  margin-top: 0.26rem;
  border-radius: 999px;
}

.profile__nav {
  display: flex;
  align-self: stretch;
  align-items: center;
  gap: 1rem;
}

.profile__actions {
  display: flex;
  align-self: stretch;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  grid-area: actions;
}

.profile__nav-link {
  min-height: 2.5rem;
  padding: 0.25rem 0;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-size: 0.78rem;
  transition: border-color 140ms ease, color 140ms ease;
}

.profile__nav-link--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}

@keyframes profile-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@keyframes profile-bio-pan {
  0%,
  15% {
    transform: translateX(0);
    opacity: 1;
  }

  60%,
  80% {
    transform: translateX(var(--profile-bio-distance));
    opacity: 1;
  }

  84% {
    transform: translateX(var(--profile-bio-distance));
    opacity: 0;
  }

  85% {
    transform: translateX(0);
    opacity: 0;
  }

  90%,
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

@media (min-width: 1280px) {
  .profile--public {
    grid-template-areas: "identity identity search actions";
    grid-template-columns:
      calc(var(--public-sidebar-width) + var(--public-layout-gap))
      minmax(0, 1fr)
      minmax(18rem, 40rem)
      minmax(0, 1fr);
    gap: 0;
  }
}

@media (min-width: 600px) and (max-width: 1279px) {
  .profile--public {
    grid-template-columns: minmax(8rem, 13rem) minmax(14rem, 1fr) auto;
    gap: 0.65rem;
  }

  .profile__identity {
    gap: 0.55rem;
  }

  .profile__avatar,
  .profile__avatar-placeholder {
    width: 2.65rem;
    height: 2.65rem;
  }

  .profile__name,
  .profile__nav-link {
    white-space: nowrap;
  }

  .profile__name {
    font-size: 0.96rem;
  }

  .profile__search {
    width: 80%;
  }

  .profile__actions {
    gap: 0.4rem;
  }

  .profile__nav {
    gap: 0.65rem;
  }

  .profile__nav-link {
    font-size: 0.72rem;
  }
}

@media (max-width: 599px) {
  .profile {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    padding: 0.8rem 0 0.72rem;
  }

  .profile--public {
    grid-template-areas:
      "identity actions"
      "search search";
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 0.55rem;
  }

  .profile__search {
    width: 100%;
  }

  .profile__identity {
    gap: 0.55rem;
  }

  .profile__avatar,
  .profile__avatar-placeholder {
    width: 2.35rem;
    height: 2.35rem;
  }

  .profile__bio-skeleton {
    width: min(13.5rem, 100%);
  }

  .profile__name {
    font-size: 0.92rem;
    white-space: nowrap;
  }

  .profile__actions {
    grid-column: auto;
    justify-self: end;
    gap: 0.25rem;
  }

  .profile__nav {
    justify-content: flex-end;
    gap: 0.5rem;
  }

  .profile__nav-link {
    min-height: 2.25rem;
    font-size: 0.7rem;
    white-space: nowrap;
  }
}

</style>
