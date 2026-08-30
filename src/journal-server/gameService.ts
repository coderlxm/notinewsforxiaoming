import { randomUUID } from 'node:crypto';
import {
  gameInputSchema,
  gameItemSchema,
  type GameImageRole,
  type GameItem,
} from '../shared/gameProtocol.js';
import { GameRepository } from './gameRepository.js';
import { JournalStorage } from './storage.js';
import { assertWebImageUpload, type WebImageUpload } from './webImage.js';

export interface GameImageUpload extends WebImageUpload {
  role: GameImageRole;
  caption?: string;
  takenAt?: string;
}

export class GameService {
  constructor(
    private readonly repository: GameRepository,
    private readonly storage: JournalStorage,
  ) {}

  list(): GameItem[] {
    return this.repository.list();
  }

  get(id: string): GameItem | null {
    return this.repository.get(id);
  }

  create(rawInput: unknown): GameItem {
    return this.repository.create(gameInputSchema.parse(rawInput));
  }

  update(id: string, rawInput: unknown): GameItem | null {
    return this.repository.update(id, gameInputSchema.parse(rawInput));
  }

  async uploadImage(gameId: string, input: GameImageUpload): Promise<GameItem | null> {
    assertWebImageUpload(input);
    const existing = this.repository.get(gameId);
    if (!existing) return null;

    const assetId = randomUUID();
    const url = `/game-media/${assetId}`;
    const now = new Date().toISOString();
    const updated = gameItemSchema.parse({
      ...existing,
      updatedAt: now,
      ...(input.role === 'cover' ? { coverUrl: url } : {}),
      ...(input.role === 'banner' ? { bannerUrl: url } : {}),
      ...(input.role === 'screenshot'
        ? {
            screenshots: [
              ...existing.screenshots,
              {
                id: assetId,
                url,
                ...(input.caption ? { caption: input.caption } : {}),
                ...(input.takenAt ? { takenAt: input.takenAt } : {}),
              },
            ],
          }
        : {}),
    });
    const relativePath = await this.storage.writeGameImage(gameId, assetId, input.buffer);
    try {
      return this.repository.attachImage(gameId, {
        id: assetId,
        gameId,
        role: input.role,
        relativePath,
        originalName: input.originalName,
        mimeType: input.mimeType,
        byteSize: input.buffer.byteLength,
        createdAt: now,
      }, updated);
    } catch (error) {
      await this.storage.deleteAsset(relativePath);
      throw error;
    }
  }
}
