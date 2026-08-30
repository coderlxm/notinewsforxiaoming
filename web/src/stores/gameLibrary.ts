import { computed, shallowRef } from 'vue';
import { defineStore } from 'pinia';
import {
  createGame as createGameRequest,
  fetchGames,
  updateGame as updateGameRequest,
  uploadGameImage,
} from '../api';
import type {
  GameEditorSubmission,
  GameInput,
  GameItem,
  GamePlatform,
  GameStatsSummary,
} from '../components/games/gameTypes';

const GAME_PLATFORMS: GamePlatform[] = ['PS5', 'PS4', 'Switch', 'PC', 'Xbox', 'iOS', 'Other'];

export const useGameLibraryStore = defineStore('gameLibrary', () => {
  const games = shallowRef<GameItem[] | null>(null);
  const loading = shallowRef(false);
  const loadError = shallowRef<string | null>(null);
  let pendingLoad: Promise<void> | null = null;

  const stats = computed<GameStatsSummary>(() => {
    const loadedGames = games.value ?? [];
    const platformCounts = Object.fromEntries(
      GAME_PLATFORMS.map(platform => [
        platform,
        loadedGames.filter(game => game.platforms.includes(platform)).length,
      ]),
    ) as Record<GamePlatform, number>;

    return {
      totalCleared: loadedGames.filter(game =>
        game.status === 'completed' || game.status === 'mastered',
      ).length,
      platinumCount: loadedGames.filter(game => game.platinumTrophy).length,
      totalHours: loadedGames.reduce((total, game) => total + game.playtimeHours, 0),
      averageRating: loadedGames.length === 0
        ? 0
        : loadedGames.reduce((total, game) => total + game.rating, 0) / loadedGames.length,
      platformCounts,
    };
  });

  async function load(): Promise<void> {
    loading.value = true;
    loadError.value = null;
    try {
      games.value = await fetchGames();
    }
    catch (reason) {
      loadError.value = reason instanceof Error ? reason.message : String(reason);
    }
    finally {
      loading.value = false;
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (games.value !== null || loadError.value !== null) return;
    if (pendingLoad !== null) return await pendingLoad;

    pendingLoad = load();
    try {
      await pendingLoad;
    }
    finally {
      pendingLoad = null;
    }
  }

  function upsert(game: GameItem): void {
    const currentGames = games.value ?? [];
    games.value = currentGames.some(item => item.id === game.id)
      ? currentGames.map(item => item.id === game.id ? game : item)
      : [game, ...currentGames];
  }

  async function uploadSubmissionImages(
    game: GameItem,
    submission: GameEditorSubmission,
  ): Promise<GameItem> {
    let saved = game;
    if (submission.coverFile) {
      saved = await uploadGameImage(saved.id, submission.coverFile, 'cover');
      upsert(saved);
    }
    if (submission.bannerFile) {
      saved = await uploadGameImage(saved.id, submission.bannerFile, 'banner');
      upsert(saved);
    }
    for (const screenshot of submission.screenshotFiles) {
      saved = await uploadGameImage(saved.id, screenshot, 'screenshot');
      upsert(saved);
    }
    return saved;
  }

  async function create(input: GameInput): Promise<GameItem> {
    const created = await createGameRequest(input);
    upsert(created);
    return created;
  }

  async function update(id: string, input: GameInput): Promise<GameItem> {
    const updated = await updateGameRequest(id, input);
    upsert(updated);
    return updated;
  }

  return {
    games,
    loading,
    loadError,
    stats,
    ensureLoaded,
    create,
    update,
    uploadSubmissionImages,
  };
});
