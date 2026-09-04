import axios from 'axios';
import type { ZodType } from 'zod';
import {
  guestbookStatusMutationResponseSchema,
  guestbookStatusRequestSchema,
  type GuestbookStatusMutationResponse,
  type GuestbookStatusRequest,
} from '../shared/guestbookProtocol.js';
import {
  journalAdminCommentMutationResponseSchema,
  journalApiErrorSchema,
  journalCommentStatusRequestSchema,
  journalDeletionResultSchema,
  journalEntrySchema,
  journalIngestRequestSchema,
  journalVisibilityRequestSchema,
  type JournalAdminCommentMutationResponse,
  type JournalCommentStatusRequest,
  type JournalDeletionResult,
  type JournalEntry,
  type JournalIngestRequest,
  type JournalVisibility,
} from '../shared/journalProtocol.js';

export class JournalClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalClientError';
  }
}

export class JournalApiClient {
  private readonly baseUrl: string;

  constructor(
    apiBaseUrl: string,
    private readonly ingestToken: string,
  ) {
    this.baseUrl = apiBaseUrl.replace(/\/$/, '');
  }

  async ingest(input: JournalIngestRequest): Promise<JournalEntry> {
    const request = journalIngestRequestSchema.parse(input);
    return this.request(
      `${this.baseUrl}/api/internal/telegram-entries`,
      'post',
      request,
      journalEntrySchema,
    );
  }

  async updateVisibility(publicId: string, visibility: JournalVisibility): Promise<JournalEntry> {
    const request = journalVisibilityRequestSchema.parse({ visibility });
    return this.request(
      `${this.baseUrl}/api/internal/telegram-entries/${encodeURIComponent(publicId)}/visibility`,
      'patch',
      request,
      journalEntrySchema,
    );
  }

  async delete(publicId: string): Promise<JournalDeletionResult> {
    return this.request(
      `${this.baseUrl}/api/internal/telegram-entries/${encodeURIComponent(publicId)}`,
      'delete',
      undefined,
      journalDeletionResultSchema,
    );
  }

  async updateCommentStatus(
    commentId: number,
    status: JournalCommentStatusRequest['status'],
  ): Promise<JournalAdminCommentMutationResponse> {
    const request = journalCommentStatusRequestSchema.parse({ status });
    return this.request(
      `${this.baseUrl}/api/internal/comments/${commentId}/status`,
      'patch',
      request,
      journalAdminCommentMutationResponseSchema,
    );
  }

  async updateGuestbookStatus(
    id: number,
    status: GuestbookStatusRequest['status'],
  ): Promise<GuestbookStatusMutationResponse> {
    const request = guestbookStatusRequestSchema.parse({ status });
    return this.request(
      `${this.baseUrl}/api/internal/guestbook/${id}/status`,
      'patch',
      request,
      guestbookStatusMutationResponseSchema,
    );
  }

  private async request<T>(
    url: string,
    method: 'delete' | 'patch' | 'post',
    data: unknown,
    responseSchema: ZodType<T>,
  ): Promise<T> {
    try {
      const response = await axios.request({
        url,
        method,
        data,
        headers: {
          Authorization: `Bearer ${this.ingestToken}`,
          'Content-Type': 'application/json',
        },
      });
      const parsed = responseSchema.safeParse(response.data);
      if (!parsed.success) {
        throw new JournalClientError('Journal 服务返回了不符合约定的数据。');
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof JournalClientError) throw error;
      if (!axios.isAxiosError(error)) throw error;

      const apiError = journalApiErrorSchema.safeParse(error.response?.data);
      if (apiError.success) {
        throw new JournalClientError(apiError.data.error);
      }
      if (error.response) {
        throw new JournalClientError(`Journal 服务请求失败（HTTP ${error.response.status}）。`);
      }
      throw new JournalClientError(`无法连接 Journal 服务：${error.message}`);
    }
  }
}
