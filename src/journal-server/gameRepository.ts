import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  gameItemSchema,
  gameRatingDimensionsSchema,
  gameScreenshotSchema,
  type GameImageRole,
  type GameInput,
  type GameItem,
} from '../shared/gameProtocol.js';

interface GameRow {
  id: string;
  title: string;
  original_title: string;
  cover_url: string;
  banner_url: string;
  platforms_json: string;
  genre_json: string;
  developer: string;
  publisher: string | null;
  release_year: number;
  status: GameItem['status'];
  completed_at: string | null;
  playtime_hours: number;
  difficulty: string | null;
  is_goty: 0 | 1;
  platinum_trophy: 0 | 1;
  rating: number;
  verdict_title: string;
  punchline: string;
  pros_json: string;
  cons_json: string;
  dimension_ratings_json: string;
  review_markdown: string;
  screenshots_json: string;
  created_at: string;
  updated_at: string;
}

interface GameImageAssetRow {
  id: string;
  game_id: string;
  role: GameImageRole;
  relative_path: string;
  original_name: string | null;
  mime_type: string;
  byte_size: number;
  created_at: string;
}

export interface GameImageAssetInput {
  id: string;
  gameId: string;
  role: GameImageRole;
  relativePath: string;
  originalName: string | null;
  mimeType: string;
  byteSize: number;
  createdAt: string;
}

export interface GameImageAsset {
  id: string;
  relativePath: string;
  originalName: string | null;
  mimeType: string;
}

export class GameRepository {
  constructor(private readonly database: Database.Database) {}

  list(): GameItem[] {
    const rows = this.database.prepare(`
      SELECT * FROM journal_games
      ORDER BY COALESCE(completed_at, created_at) DESC, created_at DESC
    `).all() as GameRow[];
    return rows.map(row => this.toGame(row));
  }

  get(id: string): GameItem | null {
    const row = this.database.prepare(`
      SELECT * FROM journal_games WHERE id = ?
    `).get(id) as GameRow | undefined;
    return row ? this.toGame(row) : null;
  }

  create(input: GameInput): GameItem {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.insertOrUpdate(id, input, now, now, 'insert');
    return this.require(id);
  }

  update(id: string, input: GameInput): GameItem | null {
    const existing = this.get(id);
    if (!existing) return null;
    this.insertOrUpdate(id, input, existing.createdAt, new Date().toISOString(), 'update');
    return this.require(id);
  }

  attachImage(
    gameId: string,
    asset: GameImageAssetInput,
    game: GameItem,
  ): GameItem {
    this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO journal_game_images (
          id, game_id, role, relative_path, original_name, mime_type, byte_size, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        asset.id,
        asset.gameId,
        asset.role,
        asset.relativePath,
        asset.originalName,
        asset.mimeType,
        asset.byteSize,
        asset.createdAt,
      );
      this.insertOrUpdate(gameId, game, game.createdAt, game.updatedAt, 'update');
    })();
    return this.require(gameId);
  }

  getImageAsset(id: string): GameImageAsset | null {
    const row = this.database.prepare(`
      SELECT * FROM journal_game_images WHERE id = ?
    `).get(id) as GameImageAssetRow | undefined;
    return row
      ? {
          id: row.id,
          relativePath: row.relative_path,
          originalName: row.original_name,
          mimeType: row.mime_type,
        }
      : null;
  }

  private require(id: string): GameItem {
    const game = this.get(id);
    if (!game) throw new Error(`Game ${id} was not found after writing.`);
    return game;
  }

  private insertOrUpdate(
    id: string,
    input: GameInput,
    createdAt: string,
    updatedAt: string,
    operation: 'insert' | 'update',
  ): void {
    const values = [
      input.title,
      input.originalTitle,
      input.coverUrl,
      input.bannerUrl,
      JSON.stringify(input.platforms),
      JSON.stringify(input.genre),
      input.developer,
      input.publisher ?? null,
      input.releaseYear,
      input.status,
      input.completedAt ?? null,
      input.playtimeHours,
      input.difficulty ?? null,
      input.isGoty ? 1 : 0,
      input.platinumTrophy ? 1 : 0,
      input.rating,
      input.verdictTitle,
      input.punchline,
      JSON.stringify(input.pros),
      JSON.stringify(input.cons),
      JSON.stringify(input.dimensionRatings),
      input.reviewMarkdown,
      JSON.stringify(input.screenshots),
    ];

    if (operation === 'insert') {
      this.database.prepare(`
        INSERT INTO journal_games (
          id, title, original_title, cover_url, banner_url, platforms_json, genre_json,
          developer, publisher, release_year, status, completed_at, playtime_hours,
          difficulty, is_goty, platinum_trophy, rating, verdict_title, punchline,
          pros_json, cons_json, dimension_ratings_json, review_markdown, screenshots_json,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(id, ...values, createdAt, updatedAt);
      return;
    }

    this.database.prepare(`
      UPDATE journal_games SET
        title = ?, original_title = ?, cover_url = ?, banner_url = ?, platforms_json = ?,
        genre_json = ?, developer = ?, publisher = ?, release_year = ?, status = ?,
        completed_at = ?, playtime_hours = ?, difficulty = ?, is_goty = ?,
        platinum_trophy = ?, rating = ?, verdict_title = ?, punchline = ?, pros_json = ?,
        cons_json = ?, dimension_ratings_json = ?, review_markdown = ?, screenshots_json = ?,
        updated_at = ?
      WHERE id = ?
    `).run(...values, updatedAt, id);
  }

  private toGame(row: GameRow): GameItem {
    return gameItemSchema.parse({
      id: row.id,
      title: row.title,
      originalTitle: row.original_title,
      coverUrl: row.cover_url,
      bannerUrl: row.banner_url,
      platforms: JSON.parse(row.platforms_json),
      genre: JSON.parse(row.genre_json),
      developer: row.developer,
      ...(row.publisher === null ? {} : { publisher: row.publisher }),
      releaseYear: row.release_year,
      status: row.status,
      ...(row.completed_at === null ? {} : { completedAt: row.completed_at }),
      playtimeHours: row.playtime_hours,
      ...(row.difficulty === null ? {} : { difficulty: row.difficulty }),
      isGoty: row.is_goty === 1,
      platinumTrophy: row.platinum_trophy === 1,
      rating: row.rating,
      verdictTitle: row.verdict_title,
      punchline: row.punchline,
      pros: JSON.parse(row.pros_json),
      cons: JSON.parse(row.cons_json),
      dimensionRatings: gameRatingDimensionsSchema.parse(JSON.parse(row.dimension_ratings_json)),
      reviewMarkdown: row.review_markdown,
      screenshots: gameScreenshotSchema.array().parse(JSON.parse(row.screenshots_json)),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
