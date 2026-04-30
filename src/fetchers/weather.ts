import axios from 'axios';
import { config } from '../config';

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
    const url = `https://p66apy3ykq.re.qweatherapi.com/v7/weather/now?location=${config.qweatherCityId}&key=${config.qweatherApiKey}`;
    const response = await axios.get(url);
    if (response.data.code === '200') {
      return {
        text: response.data.now.text,
        temp: response.data.now.temp,
        feelsLike: response.data.now.feelsLike,
        windDir: response.data.now.windDir
      };
    }
  } catch (error) {
    console.error('Failed to fetch weather:', error);
  }
  return null;
}
