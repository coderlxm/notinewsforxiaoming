import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type {
  JournalAdminComment,
  JournalAdminCommentDeletionResponse,
  JournalAdminCommentMutationResponse,
  JournalAdminInteractionsResponse,
  JournalCommentStatus,
  JournalOwnerReplyRequest,
  JournalPublicComment,
  JournalPublicInteractionsResponse,
  JournalReactionResponse,
  JournalVisitorCommentResponse,
} from '../shared/journalProtocol.js';
import type { JournalCommentRow, JournalRepository } from './repository.js';
import type { JournalCommentNotificationService } from './interactionNotification.js';

export class JournalInteractionError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'JournalInteractionError';
  }
}

const commentMarkdownOptions = {
  gfm: true,
  breaks: true,
  async: false,
} as const;

const commentSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'del', 's', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'rel', 'target'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'noopener noreferrer',
      target: '_blank',
    }),
  },
};

export function renderJournalCommentHtml(markdown: string): string {
  return sanitizeHtml(marked.parse(markdown, commentMarkdownOptions), commentSanitizeOptions);
}

function toPublicComment(row: JournalCommentRow): JournalPublicComment {
  return {
    id: row.id,
    parentId: row.parentId,
    authorName: row.authorName,
    authorRole: row.authorRole,
    contentHtml: renderJournalCommentHtml(row.contentMarkdown),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    replies: [],
  };
}

function toAdminComment(row: JournalCommentRow): JournalAdminComment {
  return { ...toPublicComment(row), status: row.status };
}

function buildPublicComments(rows: JournalCommentRow[]): JournalPublicComment[] {
  return rows
    .filter(row => row.parentId === null)
    .map((top) => ({
      ...toPublicComment(top),
      replies: rows.filter(row => row.parentId === top.id).map(row => toPublicComment(row)),
    }));
}

function buildAdminComments(rows: JournalCommentRow[]): JournalAdminComment[] {
  return rows
    .filter(row => row.parentId === null)
    .map((top) => ({
      ...toAdminComment(top),
      replies: rows.filter(row => row.parentId === top.id).map(row => toAdminComment(row)),
    }));
}

export class JournalInteractionService {
  constructor(
    private readonly repository: JournalRepository,
    private readonly notifications: JournalCommentNotificationService,
  ) {}

  listPublic(entryId: number, clientHash: string | null): JournalPublicInteractionsResponse {
    return {
      summary: this.repository.getInteractionSummary(entryId, clientHash),
      comments: buildPublicComments(this.repository.getPublicCommentRows(entryId)),
    };
  }

  listAdmin(entryId: number): JournalAdminInteractionsResponse {
    return {
      summary: this.repository.getInteractionSummary(entryId, null),
      comments: buildAdminComments(this.repository.getAdminCommentRows(entryId)),
    };
  }

  react(entryId: number, clientHash: string, reacted: boolean): JournalReactionResponse {
    if (reacted) this.repository.addReaction(entryId, clientHash, new Date().toISOString());
    else this.repository.removeReaction(entryId, clientHash);
    const summary = this.repository.getInteractionSummary(entryId, clientHash);
    return {
      reactionCount: summary.reactionCount,
      viewerReacted: summary.viewerReacted,
    };
  }

  async createVisitorComment(
    entryId: number,
    clientHash: string,
    input: { authorName: string; content: string },
  ): Promise<JournalVisitorCommentResponse> {
    const now = new Date().toISOString();
    const row = this.repository.createVisitorComment({
      entryId,
      clientHash,
      authorName: input.authorName,
      contentMarkdown: input.content,
      createdAt: now,
    });
    const summary = this.repository.getInteractionSummary(entryId, clientHash);
    await this.notifyNewComment(entryId, row);
    return {
      comment: toPublicComment(row),
      summary,
    };
  }

  createOwnerReply(
    entryId: number,
    input: JournalOwnerReplyRequest,
  ): JournalAdminCommentMutationResponse {
    const parent = this.repository.getCommentContext(input.parentId);
    if (
      !parent
      || parent.entryId !== entryId
      || parent.authorRole !== 'visitor'
      || parent.parentId !== null
    ) {
      throw new JournalInteractionError(
        400,
        'Reply parent must be a top-level visitor comment of the same entry.',
      );
    }
    const row = this.repository.createOwnerReply({
      entryId,
      parentId: input.parentId,
      contentMarkdown: input.content,
      createdAt: new Date().toISOString(),
    });
    return {
      entryId,
      comment: toAdminComment(row),
      summary: this.repository.getInteractionSummary(entryId, null),
    };
  }

  setCommentStatus(
    commentId: number,
    status: JournalCommentStatus,
  ): JournalAdminCommentMutationResponse {
    const context = this.requireComment(commentId);
    this.repository.updateCommentStatus(commentId, status, new Date().toISOString());
    return {
      entryId: context.entryId,
      comment: toAdminComment(this.repository.getCommentRow(commentId)),
      summary: this.repository.getInteractionSummary(context.entryId, null),
    };
  }

  deleteComment(commentId: number): JournalAdminCommentDeletionResponse {
    const context = this.requireComment(commentId);
    this.repository.deleteComment(commentId);
    return {
      entryId: context.entryId,
      summary: this.repository.getInteractionSummary(context.entryId, null),
    };
  }

  private requireComment(commentId: number): { entryId: number } {
    const context = this.repository.getCommentContext(commentId);
    if (!context) {
      throw new JournalInteractionError(404, 'Journal comment was not found.');
    }
    return { entryId: context.entryId };
  }

  private async notifyNewComment(entryId: number, row: JournalCommentRow): Promise<void> {
    const entry = this.repository.getByIdOrNull(entryId);
    await this.notifications.notifyNewComment({
      entryId,
      entryTitle: entry?.title ?? null,
      entryExcerpt: entry?.contentText ?? '',
      authorName: row.authorName,
      content: row.contentMarkdown,
      createdAt: row.createdAt,
      commentId: row.id,
    });
  }
}
