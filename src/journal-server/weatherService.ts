import { fetchQWeatherCurrent } from '../fetchers/qweatherCurrent.js';
import type { JournalCurrentWeather } from '../shared/journalProtocol.js';

const weatherCacheTtlMs = 10 * 60 * 1000;

interface WeatherCache {
  weather: JournalCurrentWeather;
  expiresAt: number;
}

export class JournalWeatherService {
  private cache: WeatherCache | null = null;
  private pendingRequest: Promise<JournalCurrentWeather> | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly cityId: string,
  ) {}

  async getCurrent(): Promise<JournalCurrentWeather> {
    if (this.cache !== null && Date.now() < this.cache.expiresAt) {
      return this.cache.weather;
    }
    if (this.pendingRequest !== null) return await this.pendingRequest;

    this.pendingRequest = this.fetchCurrent();
    try {
      return await this.pendingRequest;
    }
    finally {
      this.pendingRequest = null;
    }
  }

  private async fetchCurrent(): Promise<JournalCurrentWeather> {
    const weather = await fetchQWeatherCurrent(this.apiKey, this.cityId);
    this.cache = {
      weather,
      expiresAt: Date.now() + weatherCacheTtlMs,
    };
    return weather;
  }
}
