import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  createGuestbookMessage,
  createGuestbookReply,
  deleteGuestbookMessage,
  fetchAdminGuestbook,
  fetchPublicGuestbook,
  updateGuestbookPinned,
  updateGuestbookStatus,
} from '../api';
import type {
  GuestbookAdminReply,
  GuestbookMessage,
  GuestbookPublicMessage,
  GuestbookStatus,
  GuestbookVisitorCreateRequest,
} from '../../../src/shared/guestbookProtocol';

export type GuestbookScope = 'public' | 'admin';

function compareTopLevelMessages(a: GuestbookMessage, b: GuestbookMessage): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return b.id - a.id;
}

export const useGuestbookStore = defineStore('guestbook', () => {
  const messages = shallowRef<GuestbookMessage[] | null>(null);
  const loadedScope = shallowRef<GuestbookScope | null>(null);
  const loading = shallowRef(false);
  const loadError = shallowRef<string | null>(null);
  const submittingVisitor = shallowRef(false);
  const submittingReply = shallowRef(false);
  const mutatingId = shallowRef<number | null>(null);
  let pendingLoad: Promise<void> | null = null;
  let pendingLoadScope: GuestbookScope | null = null;
  let loadRevision = 0;

  const total = computed(() =>
    messages.value === null ? null : messages.value.length,
  );

  const hiddenTotal = computed(() => {
    if (messages.value === null || loadedScope.value !== 'admin') return null;
    return messages.value.filter(message => 'status' in message && message.status === 'hidden').length;
  });

  async function load(scope: GuestbookScope, revision: number): Promise<void> {
    loading.value = true;
    loadError.value = null;
    try {
      const response = scope === 'admin'
        ? await fetchAdminGuestbook()
        : await fetchPublicGuestbook();
      if (revision !== loadRevision) return;
      messages.value = response.messages;
      loadedScope.value = scope;
    }
    catch (reason) {
      if (revision !== loadRevision) return;
      loadError.value = reason instanceof Error ? reason.message : String(reason);
    }
    finally {
      if (revision === loadRevision) loading.value = false;
    }
  }

  async function ensureLoaded(scope: GuestbookScope): Promise<void> {
    if (loadedScope.value === scope && messages.value !== null) return;
    if (pendingLoad !== null && pendingLoadScope === scope) return await pendingLoad;
    if (loadedScope.value !== scope) {
      messages.value = null;
      loadedScope.value = scope;
      loadError.value = null;
    }
    const revision = ++loadRevision;
    pendingLoadScope = scope;
    const request = load(scope, revision);
    pendingLoad = request;
    try {
      await request;
    }
    finally {
      if (pendingLoad === request) {
        pendingLoad = null;
        pendingLoadScope = null;
      }
    }
  }

  async function createVisitorMessage(
    input: GuestbookVisitorCreateRequest,
    visitorId: string | null,
  ): Promise<GuestbookPublicMessage> {
    submittingVisitor.value = true;
    try {
      const response = await createGuestbookMessage(visitorId, input);
      if (loadedScope.value === 'public' && messages.value !== null) {
        messages.value = [...messages.value, response.message].sort(compareTopLevelMessages);
      }
      return response.message;
    }
    finally {
      submittingVisitor.value = false;
    }
  }

  async function createOwnerReply(parentId: number, content: string): Promise<GuestbookAdminReply> {
    submittingReply.value = true;
    try {
      const response = await createGuestbookReply(parentId, { content });
      if (loadedScope.value === 'admin' && messages.value !== null) {
        messages.value = messages.value.map((message) => {
          if (message.id !== response.parentId) return message;
          return { ...message, replies: [...message.replies, response.reply] };
        });
      }
      return response.reply;
    }
    finally {
      submittingReply.value = false;
    }
  }

  async function setStatus(id: number, status: GuestbookStatus): Promise<void> {
    mutatingId.value = id;
    try {
      const response = await updateGuestbookStatus(id, status);
      if (loadedScope.value === 'admin' && messages.value !== null) {
        messages.value = messages.value.map((message) => {
          if (message.id === id && 'status' in message) {
            return { ...message, status: response.status, updatedAt: response.updatedAt };
          }
          if (!message.replies.some(reply => reply.id === id)) return message;
          return {
            ...message,
            replies: message.replies.map(reply => reply.id === id
              ? { ...reply, status: response.status, updatedAt: response.updatedAt }
              : reply),
          };
        });
      }
    }
    finally {
      mutatingId.value = null;
    }
  }

  async function setPinned(id: number, pinned: boolean): Promise<void> {
    mutatingId.value = id;
    try {
      const response = await updateGuestbookPinned(id, pinned);
      if (loadedScope.value === 'admin' && messages.value !== null) {
        messages.value = messages.value
          .map(message => message.id === id
            ? { ...message, pinned: response.pinned, updatedAt: response.updatedAt }
            : message)
          .sort(compareTopLevelMessages);
      }
    }
    finally {
      mutatingId.value = null;
    }
  }

  async function remove(id: number): Promise<void> {
    mutatingId.value = id;
    try {
      await deleteGuestbookMessage(id);
      if (loadedScope.value === 'admin' && messages.value !== null) {
        messages.value = messages.value
          .filter(message => message.id !== id)
          .map(message => ({
            ...message,
            replies: message.replies.filter(reply => reply.id !== id),
          }));
      }
    }
    finally {
      mutatingId.value = null;
    }
  }

  return {
    messages,
    loadedScope,
    loading,
    loadError,
    submittingVisitor,
    submittingReply,
    mutatingId,
    total,
    hiddenTotal,
    ensureLoaded,
    createVisitorMessage,
    createOwnerReply,
    setStatus,
    setPinned,
    remove,
  };
});
