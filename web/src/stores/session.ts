import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchAuthenticationState } from '../api';

export const useSessionStore = defineStore('session', () => {
  const ownerAuthenticated = shallowRef(false);
  const authenticationChecked = shallowRef(false);
  const authenticationError = shallowRef<string | null>(null);
  let loadRequest: Promise<void> | null = null;

  async function fetchSession(): Promise<void> {
    authenticationError.value = null;
    try {
      ownerAuthenticated.value = (await fetchAuthenticationState()).authenticated;
      authenticationChecked.value = true;
    }
    catch (reason) {
      authenticationError.value = reason instanceof Error ? reason.message : String(reason);
    }
  }

  function load(): Promise<void> {
    if (authenticationChecked.value) return Promise.resolve();
    if (loadRequest === null) {
      loadRequest = fetchSession().finally(() => {
        loadRequest = null;
      });
    }
    return loadRequest;
  }

  function setAuthenticated(authenticated: boolean): void {
    ownerAuthenticated.value = authenticated;
    authenticationChecked.value = true;
    authenticationError.value = null;
  }

  return {
    ownerAuthenticated,
    authenticationChecked,
    authenticationError,
    load,
    setAuthenticated,
  };
});
