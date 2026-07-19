import type Database from 'better-sqlite3';
import type { JournalVisibility } from '../shared/journalProtocol.js';

export const JOURNAL_CAPTURE_SESSIONS_SQL = `
  CREATE TABLE journal_capture_sessions (
    chat_id TEXT PRIMARY KEY,
    visibility TEXT NOT NULL CHECK (visibility IN ('private', 'public')),
    prompt_message_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export interface JournalCaptureSession {
  chatId: string;
  visibility: JournalVisibility;
  promptMessageId: number;
  createdAt: string;
}

interface JournalCaptureSessionRow {
  chat_id: string;
  visibility: JournalVisibility;
  prompt_message_id: number;
  created_at: string;
}

export class JournalCaptureSessionRepository {
  constructor(private readonly database: Database.Database) {}

  find(chatId: string): JournalCaptureSession | null {
    const row = this.database.prepare(`
      SELECT chat_id, visibility, prompt_message_id, created_at
      FROM journal_capture_sessions
      WHERE chat_id = ?
    `).get(chatId) as JournalCaptureSessionRow | undefined;

    if (!row) return null;

    return {
      chatId: row.chat_id,
      visibility: row.visibility,
      promptMessageId: row.prompt_message_id,
      createdAt: row.created_at,
    };
  }

  save(input: {
    chatId: string;
    visibility: JournalVisibility;
    promptMessageId: number;
  }): JournalCaptureSession {
    const createdAt = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO journal_capture_sessions
        (chat_id, visibility, prompt_message_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(chat_id) DO UPDATE SET
        visibility = excluded.visibility,
        prompt_message_id = excluded.prompt_message_id,
        created_at = excluded.created_at
    `).run(input.chatId, input.visibility, input.promptMessageId, createdAt);

    return {
      ...input,
      createdAt,
    };
  }

  delete(chatId: string): void {
    this.database.prepare(`
      DELETE FROM journal_capture_sessions
      WHERE chat_id = ?
    `).run(chatId);
  }
}
