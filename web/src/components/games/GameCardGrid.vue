<script setup lang="ts">
import GameCard from './GameCard.vue';
import type { GameItem } from './gameTypes';

defineProps<{
  games: GameItem[];
}>();

const emit = defineEmits<{
  selectGame: [game: GameItem];
}>();
</script>

<template>
  <div class="games-grid-container">
    <div v-if="games.length > 0" class="games-grid">
      <GameCard
        v-for="game in games"
        :key="game.id"
        :game="game"
        @select="emit('selectGame', $event)"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="games-grid__empty">
      <div class="empty-icon">🎮</div>
      <h3>未找到匹配的游戏记录</h3>
      <p>尝试更换筛选条件或搜索关键词</p>
    </div>
  </div>
</template>

<style scoped>
.games-grid-container {
  width: 100%;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: clamp(1rem, 1.8vw, 1.75rem);
}

.games-grid__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 1rem;
  text-align: center;
  background: rgba(18, 22, 32, 0.4);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 16px;
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.games-grid__empty h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: #ffffff;
}

.games-grid__empty p {
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
}

@media (max-width: 540px) {
  .games-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
}
</style>
