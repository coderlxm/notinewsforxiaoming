import { getDb } from '../reminders/db.js';

export interface SteamPriceWatch {
  id: number;
  app_id: number;
  name: string;
  currency: string;
  target_price_minor: number;
  initial_price_minor: number;
  final_price_minor: number;
  discount_percent: number;
  lowest_price_minor: number;
  last_checked_at: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSteamPriceWatchInput {
  app_id: number;
  name: string;
  currency: string;
  target_price_minor: number;
  initial_price_minor: number;
  final_price_minor: number;
  discount_percent: number;
  lowest_price_minor: number;
}

export function listSteamPriceWatches(): SteamPriceWatch[] {
  return getDb().prepare('SELECT * FROM steam_price_watches ORDER BY id').all() as SteamPriceWatch[];
}

export function findSteamPriceWatchByAppId(appId: number): SteamPriceWatch | undefined {
  return getDb().prepare('SELECT * FROM steam_price_watches WHERE app_id = ?').get(appId) as SteamPriceWatch | undefined;
}

export function findSteamPriceWatchById(id: number): SteamPriceWatch | undefined {
  return getDb().prepare('SELECT * FROM steam_price_watches WHERE id = ?').get(id) as SteamPriceWatch | undefined;
}

export function createSteamPriceWatch(input: CreateSteamPriceWatchInput): SteamPriceWatch {
  const now = new Date().toISOString();
  const { lastInsertRowid } = getDb().prepare(`
    INSERT INTO steam_price_watches
      (app_id, name, currency, target_price_minor, initial_price_minor, final_price_minor,
       discount_percent, lowest_price_minor, last_checked_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.app_id, input.name, input.currency, input.target_price_minor,
    input.initial_price_minor, input.final_price_minor, input.discount_percent,
    input.lowest_price_minor, now, now, now,
  );
  return findSteamPriceWatchById(Number(lastInsertRowid))!;
}

export function updateSteamPriceTarget(id: number, newTargetMinor: number): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE steam_price_watches
    SET target_price_minor = ?, updated_at = ?
    WHERE id = ?
  `).run(newTargetMinor, now, id);
}

export function updateSteamPriceSnapshot(
  id: number,
  finalPriceMinor: number,
  initialPriceMinor: number,
  discountPercent: number,
  lowestPriceMinor: number,
): void {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE steam_price_watches
    SET final_price_minor = ?, initial_price_minor = ?, discount_percent = ?,
        lowest_price_minor = ?, last_checked_at = ?, updated_at = ?
    WHERE id = ?
  `).run(finalPriceMinor, initialPriceMinor, discountPercent, lowestPriceMinor, now, now, id);
}

export function deleteSteamPriceWatch(id: number): SteamPriceWatch | undefined {
  const watch = findSteamPriceWatchById(id);
  if (watch) {
    getDb().prepare('DELETE FROM steam_price_watches WHERE id = ?').run(id);
  }
  return watch;
}
