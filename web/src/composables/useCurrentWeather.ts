import { readonly, shallowRef } from 'vue';
import { fetchCurrentWeather } from '../api';
import type { CurrentWeather } from '../types';

export function useCurrentWeather() {
  const weather = shallowRef<CurrentWeather | null>(null);
  const loading = shallowRef(true);
  const error = shallowRef<string | null>(null);

  async function load(): Promise<void> {
    weather.value = null;
    loading.value = true;
    error.value = null;
    try {
      weather.value = await fetchCurrentWeather();
    }
    catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason);
    }
    finally {
      loading.value = false;
    }
  }

  return {
    weather: readonly(weather),
    loading: readonly(loading),
    error: readonly(error),
    load,
  };
}
