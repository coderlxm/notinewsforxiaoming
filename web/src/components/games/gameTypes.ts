import type {
  GameInput,
  GamePlatform,
} from '../../../../src/shared/gameProtocol';

export type {
  GameImageRole,
  GameInput,
  GameItem,
  GamePlatform,
  GamePlayStatus,
  GameRatingDimensions,
  GameScreenshot,
} from '../../../../src/shared/gameProtocol';

export interface GameEditorSubmission {
  input: GameInput;
  coverFile: File | null;
  bannerFile: File | null;
  screenshotFiles: File[];
}

export interface GameStatsSummary {
  totalCleared: number;
  platinumCount: number;
  totalHours: number;
  averageRating: number;
  platformCounts: Record<GamePlatform, number>;
}
