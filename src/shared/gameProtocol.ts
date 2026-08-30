import { z } from 'zod';

export const gamePlayStatusSchema = z.enum([
  'completed',
  'mastered',
  'playing',
  'shelved',
  'backlog',
]);
export type GamePlayStatus = z.infer<typeof gamePlayStatusSchema>;

export const gamePlatformSchema = z.enum([
  'PS5',
  'PS4',
  'Switch',
  'PC',
  'Xbox',
  'iOS',
  'Other',
]);
export type GamePlatform = z.infer<typeof gamePlatformSchema>;

const gameDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const gameScoreSchema = z.number().min(0).max(10);

export const gameRatingDimensionsSchema = z.object({
  gameplay: gameScoreSchema,
  story: gameScoreSchema,
  visuals: gameScoreSchema,
  music: gameScoreSchema,
  performance: gameScoreSchema,
});
export type GameRatingDimensions = z.infer<typeof gameRatingDimensionsSchema>;

export const gameScreenshotSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  caption: z.string().max(200).optional(),
  takenAt: gameDateSchema.optional(),
});
export type GameScreenshot = z.infer<typeof gameScreenshotSchema>;

export const gameInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  originalTitle: z.string().trim().max(160),
  coverUrl: z.string().trim().max(2000),
  bannerUrl: z.string().trim().max(2000),
  platforms: z.array(gamePlatformSchema).min(1),
  genre: z.array(z.string().trim().min(1).max(40)).max(20),
  developer: z.string().trim().max(120),
  publisher: z.string().trim().max(120).optional(),
  releaseYear: z.number().int(),
  status: gamePlayStatusSchema,
  completedAt: gameDateSchema.optional(),
  playtimeHours: z.number().nonnegative(),
  difficulty: z.string().trim().max(160).optional(),
  isGoty: z.boolean().optional(),
  platinumTrophy: z.boolean().optional(),
  rating: gameScoreSchema,
  verdictTitle: z.string().trim().min(1).max(40),
  punchline: z.string().trim().max(300),
  pros: z.array(z.string().trim().min(1).max(300)).max(20),
  cons: z.array(z.string().trim().min(1).max(300)).max(20),
  dimensionRatings: gameRatingDimensionsSchema,
  reviewMarkdown: z.string().max(100_000),
  screenshots: z.array(gameScreenshotSchema).max(100),
});
export type GameInput = z.infer<typeof gameInputSchema>;

export const gameItemSchema = gameInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type GameItem = z.infer<typeof gameItemSchema>;

export const gameImageRoleSchema = z.enum(['cover', 'banner', 'screenshot']);
export type GameImageRole = z.infer<typeof gameImageRoleSchema>;
