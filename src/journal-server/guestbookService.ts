import type {
  GuestbookAdminListResponse,
  GuestbookAdminMessage,
  GuestbookAdminReply,
  GuestbookDeletionResponse,
  GuestbookOwnerReplyRequest,
  GuestbookOwnerReplyResponse,
  GuestbookPinnedMutationResponse,
  GuestbookPublicListResponse,
  GuestbookPublicMessage,
  GuestbookPublicReply,
  GuestbookStatus,
  GuestbookStatusMutationResponse,
  GuestbookVisitorCreateRequest,
  GuestbookVisitorCreateResponse,
} from '../shared/guestbookProtocol.js';
import type {
  GuestbookRepository,
  GuestbookRow,
} from './guestbookRepository.js';
import type { JournalGuestbookNotificationService } from './guestbookNotification.js';
import { renderJournalCommentHtml } from './interactionService.js';

export class GuestbookError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'GuestbookError';
  }
}

function compareTopLevelMessages(a: GuestbookRow, b: GuestbookRow): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return b.id - a.id;
}

function compareReplies(a: GuestbookRow, b: GuestbookRow): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id - b.id;
}

function toPublicReply(row: GuestbookRow): GuestbookPublicReply {
  return {
    id: row.id,
    parentId: row.parentId!,
    authorRole: 'owner',
    authorName: row.authorName,
    contentHtml: renderJournalCommentHtml(row.contentMarkdown),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAdminReply(row: GuestbookRow): GuestbookAdminReply {
  return { ...toPublicReply(row), status: row.status };
}

function toPublicMessage(row: GuestbookRow): GuestbookPublicMessage {
  return {
    id: row.id,
    authorRole: 'visitor',
    authorName: row.authorName,
    contentHtml: renderJournalCommentHtml(row.contentMarkdown),
    pinned: row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    replies: [],
  };
}

function toAdminMessage(row: GuestbookRow): GuestbookAdminMessage {
  return { ...toPublicMessage(row), status: row.status, replies: [] };
}

function assembleMessages<Reply, Message extends { id: number; replies: Reply[] }>(
  rows: GuestbookRow[],
  toMessage: (row: GuestbookRow) => Message,
  toReply: (row: GuestbookRow) => Reply,
): Message[] {
  const topLevelRows: GuestbookRow[] = [];
  const replyRowsByParent = new Map<number, GuestbookRow[]>();
  for (const row of rows) {
    if (row.parentId === null) {
      topLevelRows.push(row);
      continue;
    }
    const siblings = replyRowsByParent.get(row.parentId) ?? [];
    siblings.push(row);
    replyRowsByParent.set(row.parentId, siblings);
  }
  return topLevelRows.sort(compareTopLevelMessages).map(row => ({
    ...toMessage(row),
    replies: (replyRowsByParent.get(row.id) ?? [])
      .sort(compareReplies)
      .map(toReply),
  }));
}

export class GuestbookService {
  constructor(
    private readonly repository: GuestbookRepository,
    private readonly notifications: JournalGuestbookNotificationService,
  ) {}

  listPublic(): GuestbookPublicListResponse {
    return {
      messages: assembleMessages(
        this.repository.listPublicRows(),
        toPublicMessage,
        toPublicReply,
      ),
    };
  }

  listAdmin(): GuestbookAdminListResponse {
    return {
      messages: assembleMessages(
        this.repository.listAdminRows(),
        toAdminMessage,
        toAdminReply,
      ),
    };
  }

  async createVisitor(
    input: Pick<GuestbookVisitorCreateRequest, 'authorName' | 'content'>,
  ): Promise<GuestbookVisitorCreateResponse> {
    const now = new Date().toISOString();
    const row = this.repository.createVisitor({
      authorName: input.authorName,
      contentMarkdown: input.content,
      createdAt: now,
    });
    await this.notifications.notifyNewMessage({
      messageId: row.id,
      authorName: row.authorName,
      content: row.contentMarkdown,
      createdAt: row.createdAt,
    });
    return { message: toPublicMessage(row) };
  }

  createOwnerReply(
    parentId: number,
    input: GuestbookOwnerReplyRequest,
  ): GuestbookOwnerReplyResponse {
    const parent = this.repository.getRow(parentId);
    if (!parent) throw new GuestbookError(404, '留言不存在。');
    if (parent.parentId !== null) {
      throw new GuestbookError(400, '只能回复顶层访客留言。');
    }
    const row = this.repository.createOwnerReply({
      parentId,
      contentMarkdown: input.content,
      createdAt: new Date().toISOString(),
    });
    return { parentId, reply: toAdminReply(row) };
  }

  setStatus(
    id: number,
    status: GuestbookStatus,
  ): GuestbookStatusMutationResponse {
    const row = this.repository.updateStatus(id, status, new Date().toISOString());
    if (!row) throw new GuestbookError(404, '留言不存在。');
    return { id: row.id, status: row.status, updatedAt: row.updatedAt };
  }

  setPinned(
    id: number,
    pinned: boolean,
  ): GuestbookPinnedMutationResponse {
    const target = this.repository.getRow(id);
    if (!target) throw new GuestbookError(404, '留言不存在。');
    if (target.parentId !== null) {
      throw new GuestbookError(400, '只能置顶访客留言。');
    }
    const row = this.repository.updatePinned(id, pinned, new Date().toISOString());
    if (!row) throw new GuestbookError(404, '留言不存在。');
    return { id: row.id, pinned: row.pinned, updatedAt: row.updatedAt };
  }

  delete(id: number): GuestbookDeletionResponse {
    if (!this.repository.delete(id)) throw new GuestbookError(404, '留言不存在。');
    return { id };
  }
}
