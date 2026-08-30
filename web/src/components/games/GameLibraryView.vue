<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { useGameLibraryStore } from '../../stores/gameLibrary';
import { useSessionStore } from '../../stores/session';
import { showMessage } from '../../utils/message';
import JournalLoading from '../ui/JournalLoading.vue';
import GameHeroBillboard from './GameHeroBillboard.vue';
import GameStatsHud from './GameStatsHud.vue';
import GameFilterToolbar from './GameFilterToolbar.vue';
import GameCardGrid from './GameCardGrid.vue';
import GameDetailModal from './GameDetailModal.vue';
import GameQuickAddModal from './GameQuickAddModal.vue';
import type {
  GameEditorSubmission,
  GameItem,
  GamePlatform,
  GamePlayStatus,
} from './gameTypes';

defineOptions({ name: 'GameLibraryView' });

const emit = defineEmits<{
  layoutReady: [];
}>();

const gameLibrary = useGameLibraryStore();
const session = useSessionStore();
const { games, loadError, stats } = storeToRefs(gameLibrary);
const { ownerAuthenticated } = storeToRefs(session);
const loadedGames = computed(() => games.value ?? []);

const selectedStatus = shallowRef<GamePlayStatus | 'all'>('all');
const selectedPlatform = shallowRef<GamePlatform | 'all'>('all');
const searchQuery = shallowRef('');
const sortBy = shallowRef<'date' | 'rating' | 'hours'>('date');

const activeDetailGameId = shallowRef<string | null>(null);
const isAddModalOpen = shallowRef(false);
const editingGame = shallowRef<GameItem | null>(null);
const editorReturnGameId = shallowRef<string | null>(null);
const submitting = shallowRef(false);
let active = true;

const activeDetailGame = computed(() =>
  loadedGames.value.find(game => game.id === activeDetailGameId.value) ?? null,
);

// Filtered & Sorted Games
const filteredGames = computed(() => {
  return loadedGames.value
    .filter(game => {
      if (selectedStatus.value !== 'all' && game.status !== selectedStatus.value) {
        return false;
      }
      if (selectedPlatform.value !== 'all' && !game.platforms.includes(selectedPlatform.value)) {
        return false;
      }
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase().trim();
        const matchTitle = game.title.toLowerCase().includes(query);
        const matchOrig = game.originalTitle.toLowerCase().includes(query);
        const matchDev = game.developer.toLowerCase().includes(query);
        const matchGenre = game.genre.some(g => g.toLowerCase().includes(query));
        if (!matchTitle && !matchOrig && !matchDev && !matchGenre) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy.value === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy.value === 'hours') {
        return b.playtimeHours - a.playtimeHours;
      }
      // date (default)
      const dateA = a.completedAt || '1970-01-01';
      const dateB = b.completedAt || '1970-01-01';
      return dateB.localeCompare(dateA);
    });
});

function handleSelectGame(game: GameItem): void {
  activeDetailGameId.value = game.id;
}

function openCreateModal(): void {
  editingGame.value = null;
  editorReturnGameId.value = null;
  isAddModalOpen.value = true;
}

function openEditModal(game: GameItem): void {
  editingGame.value = game;
  editorReturnGameId.value = game.id;
  activeDetailGameId.value = null;
  isAddModalOpen.value = true;
}

function closeEditor(restoreDetail = true): void {
  const returnGameId = editorReturnGameId.value;
  isAddModalOpen.value = false;
  editingGame.value = null;
  editorReturnGameId.value = null;
  if (restoreDetail) activeDetailGameId.value = returnGameId;
}

async function handleSaveGame(submission: GameEditorSubmission): Promise<void> {
  const updating = editingGame.value !== null;
  let savedGame: GameItem | null = null;
  submitting.value = true;
  try {
    savedGame = editingGame.value
      ? await gameLibrary.update(editingGame.value.id, submission.input)
      : await gameLibrary.create(submission.input);
    savedGame = await gameLibrary.uploadSubmissionImages(savedGame, submission);
    closeEditor(false);
    activeDetailGameId.value = savedGame.id;
    showMessage({
      message: updating ? '游戏档案已更新。' : '游戏档案已加入成就墙。',
      type: 'success',
    });
  }
  catch (reason) {
    if (savedGame !== null) {
      closeEditor(false);
      activeDetailGameId.value = savedGame.id;
    }
    showMessage({
      message: reason instanceof Error ? reason.message : String(reason),
      type: 'error',
    });
  }
  finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([session.load(), gameLibrary.ensureLoaded()]);
  if (!active) return;
  await nextTick();
  if (!active) return;
  emit('layoutReady');
});

onBeforeUnmount(() => {
  active = false;
});
</script>

<template>
  <main class="game-library">
    <JournalLoading
      v-if="!games && !loadError"
      variant="canvas"
      label="正在整理游戏成就…"
    />

    <section v-else-if="loadError && !games" class="game-library__state" role="alert">
      <h1>游戏成就墙没有加载完成</h1>
      <p>{{ loadError }}</p>
    </section>

    <template v-else>
      <!-- 1. Hero 殿堂精选 / GOTY Showcase (Full-Bleed 100% 宽幅海报) -->
      <GameHeroBillboard
        :games="loadedGames"
        @select-game="handleSelectGame"
      />

      <!-- 2. 下方流式内容区 (满宽自适应网格) -->
      <div class="game-library__content">
        <!-- 生涯统计 HUD (XiaoHeiHe / PSN style) -->
        <GameStatsHud
          :stats="stats"
          :games="loadedGames"
        />

        <!-- 筛选与操作栏 (Filter & Quick Add) -->
        <GameFilterToolbar
          v-model:selected-status="selectedStatus"
          v-model:selected-platform="selectedPlatform"
          v-model:search-query="searchQuery"
          v-model:sort-by="sortBy"
          :owner-authenticated="ownerAuthenticated"
          @open-quick-add="openCreateModal"
        />

        <!-- 游戏成就画廊 Grid -->
        <GameCardGrid
          :games="filteredGames"
          @select-game="handleSelectGame"
        />
      </div>
    </template>

    <!-- 3. 沉浸式游戏档案详情弹层 (IGN Style Verdict) -->
    <GameDetailModal
      v-if="activeDetailGame"
      :game="activeDetailGame"
      :owner-authenticated="ownerAuthenticated"
      @close="activeDetailGameId = null"
      @edit="openEditModal"
    />

    <!-- 4. 快捷录入与编辑弹层 -->
    <GameQuickAddModal
      v-if="isAddModalOpen"
      :key="editingGame?.id ?? 'create'"
      :game="editingGame"
      :submitting="submitting"
      @close="closeEditor"
      @save="handleSaveGame"
    />
  </main>
</template>

<style scoped>
.game-library {
  --game-canvas: #090a0f;
  --game-surface: #10141d;
  --game-border: rgba(255, 255, 255, 0.08);
  --game-edge: clamp(1rem, 2.5vw, 3rem);

  width: 100%;
  min-height: 100%;
  background: var(--game-canvas);
  color: #ffffff;
  padding-bottom: 4rem;
}

.game-library__content {
  width: 100%;
  padding: 0 var(--game-edge);
  box-sizing: border-box;
}

.game-library__state {
  display: grid;
  min-height: 24rem;
  align-content: center;
  gap: 0.65rem;
  padding: 2rem;
  text-align: center;
}

.game-library__state h1,
.game-library__state p {
  margin: 0;
}

.game-library__state h1 {
  font-size: 1.2rem;
}

.game-library__state p {
  color: #fca5a5;
  font-size: 0.85rem;
}
</style>
