import { shallowRef } from 'vue';
import { defineStore } from 'pinia';
import { fetchAuthenticationState } from '../api';

export const useSessionStore = defineStore('session', () => {
  const ownerAuthenticated = shallowRef(false);

  async function load(): Promise<void> {
    ownerAuthenticated.value = (await fetchAuthenticationState()).authenticated;
  }

  function setAuthenticated(authenticated: boolean): void {
    ownerAuthenticated.value = authenticated;
  }

  return {
    ownerAuthenticated,
    load,
    setAuthenticated,
  };
});
