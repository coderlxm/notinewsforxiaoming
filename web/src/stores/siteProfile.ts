import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchSiteProfile, updateSiteProfile } from '../api';
import type {
  ChannelTags,
  JournalAdminResumeSummary,
  SiteContactItem,
  SiteProfile,
} from '../types';

export const useSiteProfileStore = defineStore('siteProfile', () => {
  const profile = shallowRef<SiteProfile | null>(null);
  const loading = shallowRef(false);
  const loadError = shallowRef<string | null>(null);
  let pendingLoad: Promise<void> | null = null;

  async function load(): Promise<void> {
    if (pendingLoad !== null) return await pendingLoad;
    pendingLoad = loadOnce();
    try {
      await pendingLoad;
    }
    finally {
      pendingLoad = null;
    }
  }

  async function loadOnce(): Promise<void> {
    loading.value = true;
    profile.value = null;
    loadError.value = null;
    try {
      profile.value = await fetchSiteProfile();
    }
    catch (reason) {
      loadError.value = reason instanceof Error ? reason.message : String(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (profile.value !== null || loadError.value !== null) return;
    await load();
  }

  async function update(input: {
    bio: string;
    avatar: File | null;
    weatherEnabled: boolean;
    channelTags: ChannelTags;
    aboutIntro: string;
    contactItems: SiteContactItem[];
  }): Promise<SiteProfile> {
    const updated = await updateSiteProfile(input);
    profile.value = updated;
    return updated;
  }

  function setResumeFromAdmin(summary: JournalAdminResumeSummary | null): void {
    if (profile.value === null) return;
    const resume = summary?.accessMode === 'protected' || summary?.accessMode === 'public'
      ? {
          format: summary.format,
          originalName: summary.originalName,
          updatedAt: summary.updatedAt,
          viewUrl: '/resume' as const,
          accessMode: summary.accessMode,
        }
      : null;
    profile.value = { ...profile.value, resume };
  }

  return {
    profile,
    loading,
    loadError,
    load,
    ensureLoaded,
    update,
    setResumeFromAdmin,
  };
});
