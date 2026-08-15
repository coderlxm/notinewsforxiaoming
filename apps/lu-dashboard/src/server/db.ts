import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import type { MasturbationRecord } from '../shared/dashboard'
import { config } from './config'

const dbPath = resolve(config.databasePath)
const db = new Database(dbPath, { readonly: true, fileMustExist: true })

interface RecordRow {
  id: number
  occurred_at: string
}

const stmt = db.prepare(
  'SELECT id, occurred_at FROM masturbation_records ORDER BY occurred_at ASC',
)

export function loadRecords(): MasturbationRecord[] {
  return (stmt.all() as RecordRow[]).map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
  }))
}
