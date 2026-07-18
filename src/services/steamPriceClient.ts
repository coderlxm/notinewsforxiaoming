import axios from 'axios';
import { z } from 'zod';

const steamAppDetailsSchema = z.object({
  success: z.boolean(),
  data: z.object({
    steam_appid: z.number().int().positive(),
    name: z.string(),
    price_overview: z.object({
      currency: z.string(),
      initial: z.number().int().min(0),
      final: z.number().int().min(0),
      discount_percent: z.number().int().min(0).max(100),
    }),
  }).optional(),
});

export interface SteamPrice {
  appId: number;
  name: string;
  currency: string;
  initialPriceMinor: number;
  finalPriceMinor: number;
  discountPercent: number;
}

export async function fetchSteamPrice(appId: number): Promise<SteamPrice> {
  const response = await axios.get('https://store.steampowered.com/api/appdetails', {
    params: { appids: appId, cc: 'CN', l: 'schinese' },
    responseType: 'json',
  });
  const raw = response.data?.[String(appId)];
  const parsed = steamAppDetailsSchema.parse(raw);
  if (!parsed.success) {
    throw new Error(`Steam API returned success=false for app ${appId}`);
  }
  if (!parsed.data) {
    throw new Error(`Steam API response is missing data for app ${appId}`);
  }
  if (parsed.data.steam_appid !== appId) {
    throw new Error(`Steam API returned app ${parsed.data.steam_appid}, expected ${appId}`);
  }
  if (parsed.data.price_overview.currency !== 'CNY') {
    throw new Error(`Unexpected currency for app ${appId}: ${parsed.data.price_overview.currency}`);
  }
  return {
    appId,
    name: parsed.data.name,
    currency: parsed.data.price_overview.currency,
    initialPriceMinor: parsed.data.price_overview.initial,
    finalPriceMinor: parsed.data.price_overview.final,
    discountPercent: parsed.data.price_overview.discount_percent,
  };
}
