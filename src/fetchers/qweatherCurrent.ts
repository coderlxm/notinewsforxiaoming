import axios from 'axios';
import { z } from 'zod';

const qweatherApiHost = 'https://p66apy3ykq.re.qweatherapi.com';
const qweatherNumberSchema = z.string().regex(/^-?\d+(?:\.\d+)?$/);
const qweatherCodeSchema = z.object({
  code: z.string(),
});
const qweatherCurrentResponseSchema = z.object({
  code: z.literal('200'),
  now: z.object({
    obsTime: z.string().datetime({ offset: true }),
    temp: qweatherNumberSchema,
    feelsLike: qweatherNumberSchema,
    text: z.string().min(1),
    windDir: z.string().min(1),
  }),
});

export interface QWeatherCurrent {
  text: string;
  temperature: number;
  feelsLike: number;
  windDirection: string;
  observedAt: string;
}

export async function fetchQWeatherCurrent(
  apiKey: string,
  cityId: string,
): Promise<QWeatherCurrent> {
  const response = await axios.get<unknown>(`${qweatherApiHost}/v7/weather/now`, {
    params: {
      location: cityId,
      key: apiKey,
    },
  });
  const codeResult = qweatherCodeSchema.safeParse(response.data);
  if (!codeResult.success) {
    throw new Error(`QWeather response is invalid: ${codeResult.error.message}`);
  }
  if (codeResult.data.code !== '200') {
    throw new Error(`QWeather returned code ${codeResult.data.code}.`);
  }

  const result = qweatherCurrentResponseSchema.safeParse(response.data);
  if (!result.success) {
    throw new Error(`QWeather current weather response is invalid: ${result.error.message}`);
  }

  return {
    text: result.data.now.text,
    temperature: Number(result.data.now.temp),
    feelsLike: Number(result.data.now.feelsLike),
    windDirection: result.data.now.windDir,
    observedAt: result.data.now.obsTime,
  };
}
