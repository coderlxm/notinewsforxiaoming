<script setup lang="ts">
import type { GamePlatform, GamePlayStatus } from './gameTypes';

const props = defineProps<{
  selectedStatus: GamePlayStatus | 'all';
  selectedPlatform: GamePlatform | 'all';
  searchQuery: string;
  sortBy: 'date' | 'rating' | 'hours';
  ownerAuthenticated: boolean;
}>();

const emit = defineEmits<{
  'update:selectedStatus': [status: GamePlayStatus | 'all'];
  'update:selectedPlatform': [platform: GamePlatform | 'all'];
  'update:searchQuery': [query: string];
  'update:sortBy': [sort: 'date' | 'rating' | 'hours'];
  openQuickAdd: [];
}>();

const STATUS_OPTIONS: Array<{ label: string; value: GamePlayStatus | 'all' }> = [
  { label: '全部作品', value: 'all' },
  { label: '🏆 白金/完美', value: 'mastered' },
  { label: '✓ 已通关', value: 'completed' },
  { label: '🎮 正在游玩', value: 'playing' },
];

const PLATFORM_OPTIONS: Array<{ label: string; value: GamePlatform | 'all' }> = [
  { label: '全部平台', value: 'all' },
  { label: 'PS5', value: 'PS5' },
  { label: 'Steam/PC', value: 'PC' },
  { label: 'Switch', value: 'Switch' },
];
</script>

<template>
  <div class="filter-toolbar">
    <!-- Left Filters: Status Pills & Platform -->
    <div class="filter-toolbar__left">
      <div class="status-pills">
        <button
          v-for="item in STATUS_OPTIONS"
          :key="item.value"
          type="button"
          class="pill-btn"
          :class="{ 'pill-btn--active': selectedStatus === item.value }"
          @click="emit('update:selectedStatus', item.value)"
        >
          {{ item.label }}
        </button>
      </div>

      <div class="platform-pills">
        <button
          v-for="item in PLATFORM_OPTIONS"
          :key="item.value"
          type="button"
          class="pill-btn pill-btn--small"
          :class="{ 'pill-btn--active': selectedPlatform === item.value }"
          @click="emit('update:selectedPlatform', item.value)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <!-- Right Controls: Search, Sort & Quick Add -->
    <div class="filter-toolbar__right">
      <!-- Search Input -->
      <div class="search-box">
        <svg viewBox="0 0 20 20" fill="currentColor" class="search-box__icon">
          <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
        </svg>
        <input
          type="text"
          :value="searchQuery"
          placeholder="搜索游戏名称、开发商..."
          class="search-box__input"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Sort Selector -->
      <div class="sort-selector">
        <select
          :value="sortBy"
          class="sort-selector__select"
          @change="emit('update:sortBy', ($event.target as HTMLSelectElement).value as any)"
        >
          <option value="date">按通关时间排序</option>
          <option value="rating">按个人评分排序</option>
          <option value="hours">按游玩时长排序</option>
        </select>
      </div>

      <!-- Quick Add Button -->
      <button
        v-if="ownerAuthenticated"
        type="button"
        class="add-game-btn"
        @click="emit('openQuickAdd')"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" class="add-icon">
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        <span>录入通关游戏</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: rgba(16, 20, 29, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  backdrop-filter: blur(8px);
}

.filter-toolbar__left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.status-pills,
.platform-pills {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pill-btn {
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pill-btn:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.06);
}

.pill-btn--active {
  color: #ffffff;
  background: rgba(37, 99, 235, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.2);
}

.pill-btn--small {
  padding: 0.3rem 0.6rem;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  border-radius: 6px;
}

.pill-btn--small.pill-btn--active {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}

.filter-toolbar__right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-box__icon {
  position: absolute;
  left: 0.75rem;
  width: 16px;
  height: 16px;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

.search-box__input {
  padding: 0.45rem 0.85rem 0.45rem 2.2rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.85rem;
  outline: none;
  width: 210px;
  transition: all 0.2s ease;
}

.search-box__input:focus {
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(0, 0, 0, 0.55);
  width: 250px;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
}

.search-box__input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

.sort-selector__select {
  padding: 0.45rem 0.75rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
  outline: none;
  cursor: pointer;
}

.sort-selector__select:focus {
  border-color: rgba(59, 130, 246, 0.6);
}

.add-game-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.85rem;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.35));
  border: 1px solid rgba(250, 204, 21, 0.4);
  border-radius: 8px;
  color: #fef08a;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-game-btn:hover {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.35), rgba(202, 138, 4, 0.5));
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(234, 179, 8, 0.25);
}

.add-icon {
  width: 16px;
  height: 16px;
}

@media (max-width: 768px) {
  .filter-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .filter-toolbar__left,
  .filter-toolbar__right {
    width: 100%;
    justify-content: space-between;
  }
  .search-box {
    flex: 1;
  }
  .search-box__input {
    width: 100%;
  }
  .search-box__input:focus {
    width: 100%;
  }
}
</style>
