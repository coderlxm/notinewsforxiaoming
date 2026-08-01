<script setup lang="ts">
import { computed, watch } from 'vue';
import type { CurrentWeather } from '../../types';
import { showMessage } from '../../utils/message';

const props = defineProps<{
  weather: CurrentWeather | null;
  loading: boolean;
  error: string | null;
}>();

const observedTime = computed(() => {
  if (props.weather === null) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(props.weather.observedAt));
});

const accessibleLabel = computed(() => {
  if (props.loading) return '正在读取当前天气';
  if (props.error !== null) return `天气读取失败：${props.error}`;
  if (props.weather === null) return '当前天气不可用';
  return `当前天气：${props.weather.temperature}度，${props.weather.text}，体感${props.weather.feelsLike}度，${props.weather.windDirection}`;
});

watch(() => props.error, (error) => {
  if (error) showMessage({ message: `天气读取失败：${error}`, type: 'error' });
});
</script>

<template>
  <section
    class="current-weather"
    :aria-busy="loading"
    :aria-label="accessibleLabel"
  >
    <template v-if="loading">
      <div class="current-weather__main" aria-hidden="true">
        <span class="current-weather__skeleton current-weather__skeleton--temperature" />
        <span class="current-weather__skeleton current-weather__skeleton--text" />
        <span class="current-weather__skeleton current-weather__skeleton--details" />
      </div>
      <span
        class="current-weather__skeleton current-weather__skeleton--time"
        aria-hidden="true"
      />
    </template>
    <template v-else-if="weather !== null">
      <div class="current-weather__main">
        <strong class="current-weather__temperature">{{ weather.temperature }}°</strong>
        <span class="current-weather__text">{{ weather.text }}</span>
        <span class="current-weather__details">
          体感 {{ weather.feelsLike }}° · {{ weather.windDirection }}
        </span>
      </div>
      <time class="current-weather__time" :datetime="weather.observedAt">
        {{ observedTime }} 实况
      </time>
    </template>
  </section>
</template>

<style scoped>
.current-weather {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  min-height: 1.5rem;
  padding: 0 0.15rem 0.15rem;
  color: var(--text-primary);
}

.current-weather__main {
  display: grid;
  grid-template-columns: 2.4rem 2.5rem 8rem;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.current-weather__temperature {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 650;
  line-height: 1;
  letter-spacing: -0.03em;
}

.current-weather__text,
.current-weather__details,
.current-weather__time {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.current-weather__text {
  font-size: 0.82rem;
  font-weight: 600;
}

.current-weather__details,
.current-weather__time {
  color: var(--text-muted);
  font-size: 0.72rem;
  letter-spacing: 0.01em;
}

.current-weather__time {
  flex: none;
  width: 4.5rem;
  text-align: right;
}

.current-weather__skeleton {
  display: block;
  border-radius: 999px;
  background: var(--surface-muted);
  animation: current-weather-skeleton-pulse 1.4s ease-in-out infinite;
}

.current-weather__skeleton--temperature {
  width: 2.4rem;
  height: 1.35rem;
}

.current-weather__skeleton--text {
  width: 2.5rem;
  height: 0.78rem;
}

.current-weather__skeleton--details {
  width: 8rem;
  height: 0.72rem;
}

.current-weather__skeleton--time {
  flex: none;
  width: 4.5rem;
  height: 0.72rem;
}

@keyframes current-weather-skeleton-pulse {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 1;
  }
}

@media (max-width: 599px) {
  .current-weather {
    gap: 0.65rem;
  }

  .current-weather__main {
    grid-template-columns: 2.4rem 2.5rem;
    gap: 0.5rem;
  }

  .current-weather__details,
  .current-weather__skeleton--details {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .current-weather__skeleton {
    animation: none;
  }
}
</style>
