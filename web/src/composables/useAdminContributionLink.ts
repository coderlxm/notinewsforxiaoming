import { readonly, shallowRef } from 'vue';
import {
  createAdminContributionLink,
  fetchAdminContributionLink,
  revokeAdminContributionLink,
} from '../api';
import type { AdminContributionLink, ContributionLinkLifetime } from '../types';

export function useAdminContributionLink() {
  const link = shallowRef<AdminContributionLink | null>(null);
  const loading = shallowRef(false);
  const mutation = shallowRef<'create' | 'revoke' | null>(null);
  const error = shallowRef<string | null>(null);

  function exposeError(reason: unknown): void {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }

  async function load(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const response = await fetchAdminContributionLink();
      link.value = response.link;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function create(lifetime: ContributionLinkLifetime): Promise<void> {
    mutation.value = 'create';
    error.value = null;
    try {
      const response = await createAdminContributionLink(lifetime);
      link.value = response.link;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      mutation.value = null;
    }
  }

  async function revoke(): Promise<void> {
    mutation.value = 'revoke';
    error.value = null;
    try {
      await revokeAdminContributionLink();
      link.value = null;
    }
    catch (reason) {
      exposeError(reason);
    }
    finally {
      mutation.value = null;
    }
  }

  function setError(reason: unknown): void {
    exposeError(reason);
  }

  return {
    link: readonly(link),
    loading: readonly(loading),
    mutation: readonly(mutation),
    error: readonly(error),
    load,
    create,
    revoke,
    setError,
  };
}
