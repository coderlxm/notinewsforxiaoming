import { config } from '../config/index.js';
import { fetchQWeatherCurrent } from './qweatherCurrent.js';

export interface WeatherData {
  text: string;
  temp: string;
  feelsLike: string;
  windDir: string;
}
// test
export async function fetchWeather(): Promise<WeatherData | null> {
  if (!config.qweatherApiKey || !config.qweatherCityId) {
    console.warn('Weather API Key or City ID is not set. Skipping weather fetch.');
    return null;
  }

  try {
    const weather = await fetchQWeatherCurrent(
      config.qweatherApiKey,
      config.qweatherCityId,
    );
    return {
      text: weather.text,
      temp: String(weather.temperature),
      feelsLike: String(weather.feelsLike),
      windDir: weather.windDirection,
    };
  } catch (error) {
    console.error('Failed to fetch weather:', error);
  }
  return null;
}
