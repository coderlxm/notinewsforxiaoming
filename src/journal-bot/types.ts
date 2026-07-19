import type Database from 'better-sqlite3';

export interface RegisterJournalBotHandlersOptions {
  apiBaseUrl: string;
  ingestToken: string;
  publicBaseUrl: string;
  allowedChatId: string;
  database: Database.Database;
}
