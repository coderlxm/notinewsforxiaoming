import { onMounted, shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import {
  createEntryComment,
  createOwnerCommentReply,
  deleteAdminComment,
  fetchAdminEntryInteractions,
  fetchEntryInteractions,
  setEntryReaction,
  updateAdminCommentStatus,
} from '../api';
import type {
  JournalAdminComment,
  JournalAdminCommentStatus,
  JournalInteractionSummary,
  JournalPublicComment,
  JournalEntry,
} from '../types';
import { showMessage } from '../utils/message';
import {
  getOrCreateJournalVisitorId,
  getRememberedJournalVisitorName,
  rememberJournalVisitorName,
} from '../utils/journalVisitorIdentity';

export type InteractionComment = JournalPublicComment | JournalAdminComment;

const visitorIdentityUnavailableMessage = '浏览器匿名身份不可用，无法保存互动。';

function exposeInteractionError(reason: unknown): void {
  showMessage({
    message: reason instanceof Error ? reason.message : String(reason),
    type: 'error',
  });
}

function applyCommentStatus(
  list: InteractionComment[],
  commentId: number,
  status: JournalAdminCommentStatus,
  updatedAt: string,
): InteractionComment[] {
  return list.map((item) => {
    if (item.id === commentId) {
      return { ...item, status, updatedAt };
    }
    return {
      ...item,
      replies: item.replies.map(reply => reply.id === commentId
        ? { ...reply, status, updatedAt }
        : reply),
    };
  });
}

function removeCommentFromList(
  list: InteractionComment[],
  commentId: number,
): InteractionComment[] {
  return list
    .filter(item => item.id !== commentId)
    .map(item => ({
      ...item,
      replies: item.replies.filter(reply => reply.id !== commentId),
    }));
}

export interface UseJournalInteractionsOptions {
  mode: 'public' | 'private';
  entry: JournalEntry;
  onSummaryChange?: (summary: JournalInteractionSummary) => void;
}

export function useJournalInteractions(options: UseJournalInteractionsOptions) {
  const { mode, entry, onSummaryChange } = options;

  const summary = shallowRef<JournalInteractionSummary>({ ...entry.interactions });
  const comments: ShallowRef<InteractionComment[] | null> = shallowRef(null);
  const loadingComments = shallowRef(false);
  const reactionPending = shallowRef(false);
  const submittingComment = shallowRef(false);
  const mutatingCommentId = shallowRef<number | null>(null);
  const pendingComment = shallowRef<{ authorName: string; content: string } | null>(null);

  function changeSummary(next: JournalInteractionSummary): void {
    summary.value = next;
    onSummaryChange?.(next);
  }

  async function loadComments(): Promise<void> {
    loadingComments.value = true;
    try {
      if (mode === 'public') {
        const response = await fetchEntryInteractions(
          entry.publicId,
          getOrCreateJournalVisitorId(),
        );
        comments.value = response.comments;
        changeSummary(response.summary);
      }
      else {
        const response = await fetchAdminEntryInteractions(entry.id);
        comments.value = response.comments;
        changeSummary(response.summary);
      }
    }
    catch (reason) {
      exposeInteractionError(reason);
    }
    finally {
      loadingComments.value = false;
    }
  }

  async function setReaction(reacted: boolean): Promise<void> {
    if (reactionPending.value) return;
    const visitorId = getOrCreateJournalVisitorId();
    if (!visitorId) {
      showMessage({ message: visitorIdentityUnavailableMessage, type: 'error' });
      return;
    }
    const previous = summary.value;
    reactionPending.value = true;
    summary.value = {
      ...previous,
      reactionCount: previous.reactionCount + (reacted ? 1 : -1),
      viewerReacted: reacted,
    };
    try {
      const response = await setEntryReaction(entry.publicId, visitorId, reacted);
      changeSummary({
        ...summary.value,
        reactionCount: response.reactionCount,
        viewerReacted: response.viewerReacted,
      });
    }
    catch (reason) {
      summary.value = previous;
      exposeInteractionError(reason);
    }
    finally {
      reactionPending.value = false;
    }
  }

  async function submitVisitorComment(input: {
    authorName: string;
    content: string;
    website: string;
  }): Promise<boolean> {
    if (submittingComment.value) return false;
    const visitorId = getOrCreateJournalVisitorId();
    if (!visitorId) {
      showMessage({ message: visitorIdentityUnavailableMessage, type: 'error' });
      return false;
    }
    submittingComment.value = true;
    pendingComment.value = { authorName: input.authorName, content: input.content };
    try {
      const response = await createEntryComment(entry.publicId, visitorId, {
        authorName: input.authorName,
        content: input.content,
        website: input.website,
      });
      pendingComment.value = null;
      comments.value = [...comments.value ?? [], response.comment];
      rememberJournalVisitorName(input.authorName);
      changeSummary(response.summary);
      return true;
    }
    catch (reason) {
      pendingComment.value = null;
      exposeInteractionError(reason);
      return false;
    }
    finally {
      submittingComment.value = false;
    }
  }

  async function submitOwnerReply(parentId: number, content: string): Promise<boolean> {
    if (submittingComment.value) return false;
    submittingComment.value = true;
    try {
      const response = await createOwnerCommentReply(entry.id, { parentId, content });
      comments.value = (comments.value ?? []).map((item) => item.id === parentId
        ? { ...item, replies: [...item.replies, response.comment] }
        : item);
      changeSummary(response.summary);
      return true;
    }
    catch (reason) {
      exposeInteractionError(reason);
      return false;
    }
    finally {
      submittingComment.value = false;
    }
  }

  async function setCommentStatus(
    commentId: number,
    status: JournalAdminCommentStatus,
  ): Promise<void> {
    if (mutatingCommentId.value !== null) return;
    mutatingCommentId.value = commentId;
    try {
      const response = await updateAdminCommentStatus(commentId, status);
      comments.value = applyCommentStatus(
        comments.value ?? [],
        commentId,
        status,
        response.comment.updatedAt,
      );
      changeSummary(response.summary);
    }
    catch (reason) {
      exposeInteractionError(reason);
    }
    finally {
      mutatingCommentId.value = null;
    }
  }

  async function removeComment(commentId: number): Promise<void> {
    if (mutatingCommentId.value !== null) return;
    mutatingCommentId.value = commentId;
    try {
      const response = await deleteAdminComment(commentId);
      comments.value = removeCommentFromList(comments.value ?? [], commentId);
      changeSummary(response.summary);
    }
    catch (reason) {
      exposeInteractionError(reason);
    }
    finally {
      mutatingCommentId.value = null;
    }
  }

  onMounted(() => {
    void loadComments();
  });

  return {
    summary,
    comments,
    loadingComments,
    reactionPending,
    submittingComment,
    mutatingCommentId,
    pendingComment,
    rememberedVisitorName: getRememberedJournalVisitorName(),
    setReaction,
    submitVisitorComment,
    submitOwnerReply,
    setCommentStatus,
    removeComment,
  };
}
