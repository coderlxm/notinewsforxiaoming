import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchSiteProfile, updateSiteProfile } from '../api';
import type { SiteProfile } from '../types';

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

  async function update(
    bio: string,
    avatar: File | null,
    weatherEnabled: boolean,
  ): Promise<SiteProfile> {
    const updated = await updateSiteProfile({ bio, avatar, weatherEnabled });
    profile.value = updated;
    return updated;
  }

  return {
    profile,
    loading,
    loadError,
    load,
    ensureLoaded,
    update,
  };
});
