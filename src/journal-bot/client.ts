import axios from 'axios';
import {
  journalApiErrorSchema,
  journalEntrySchema,
  journalIngestRequestSchema,
  journalVisibilityRequestSchema,
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
    return this.requestEntry(
      `${this.baseUrl}/api/internal/telegram-entries`,
      'post',
      request,
    );
  }

  async updateVisibility(publicId: string, visibility: JournalVisibility): Promise<JournalEntry> {
    const request = journalVisibilityRequestSchema.parse({ visibility });
    return this.requestEntry(
      `${this.baseUrl}/api/internal/telegram-entries/${encodeURIComponent(publicId)}/visibility`,
      'patch',
      request,
    );
  }

  private async requestEntry(
    url: string,
    method: 'post' | 'patch',
    data: unknown,
  ): Promise<JournalEntry> {
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
      const parsed = journalEntrySchema.safeParse(response.data);
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
