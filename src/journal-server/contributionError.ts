import type { JournalContributionErrorCode } from '../shared/journalProtocol.js';

export class JournalContributionError extends Error {
  constructor(
    readonly code: JournalContributionErrorCode,
    message: string,
    readonly statusCode: number,
    readonly filename?: string,
  ) {
    super(message);
  }

  response(): {
    error: {
      code: JournalContributionErrorCode;
      message: string;
      filename?: string;
    };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.filename ? { filename: this.filename } : {}),
      },
    };
  }
}
