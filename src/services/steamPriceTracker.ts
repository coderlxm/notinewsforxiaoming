import type { Telegraf } from 'telegraf';
import { config } from '../config/index.js';
import { fetchSteamPrice } from './steamPriceClient.js';
import * as repo from './steamPriceRepository.js';
import { formatSteamPriceAlert } from '../formatters/steamPriceFormatter.js';

export function resolveSteamAppReference(raw: string): number | null {
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    const appId = Number(trimmed);
    return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:'
      || url.hostname !== 'store.steampowered.com'
      || url.username
      || url.password
      || url.port) {
      return null;
    }
    const match = url.pathname.match(/^\/app\/(\d+)(?:\/|$)/);
    if (match) {
      const appId = Number(match[1]);
      return Number.isSafeInteger(appId) && appId > 0 ? appId : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function parseTargetPrice(raw: string): number {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    throw new Error('目标价格无效，请输入正数人民币金额，最多两位小数。例如：180 或 25.50');
  }
  const integer = parseInt(match[1], 10);
  const fraction = match[2] ? parseInt(match[2].padEnd(2, '0'), 10) : 0;
  const price = integer * 100 + fraction;
  if (price <= 0 || !Number.isSafeInteger(price)) {
    throw new Error('目标价格无效，请输入正数人民币金额，最多两位小数。例如：180 或 25.50');
  }
  return price;
}

export function shouldNotifySteamPrice(previous: number, current: number, target: number): boolean {
  return (previous > target && current <= target)
    || (previous <= target && current < previous);
}

export async function createSteamPriceWatch(
  appRef: string,
  targetPriceRaw: string,
): Promise<{ watch: repo.SteamPriceWatch; atTarget: boolean }> {
  const appId = resolveSteamAppReference(appRef);
  if (!appId) {
    throw new Error('Steam App 链接或 AppID 格式无效。');
  }

  const targetPriceMinor = parseTargetPrice(targetPriceRaw);
  const price = await fetchSteamPrice(appId);

  const existing = repo.findSteamPriceWatchByAppId(appId);
  if (existing) {
    throw new Error(`该游戏已在监控中：${existing.name}（#${existing.id}）`);
  }

  const lowestPriceMinor = price.finalPriceMinor;
  const watch = repo.createSteamPriceWatch({
    app_id: appId,
    name: price.name,
    currency: 'CNY',
    target_price_minor: targetPriceMinor,
    initial_price_minor: price.initialPriceMinor,
    final_price_minor: price.finalPriceMinor,
    discount_percent: price.discountPercent,
    lowest_price_minor: lowestPriceMinor,
  });

  const atTarget = price.finalPriceMinor <= targetPriceMinor;
  return { watch, atTarget };
}

export async function runSteamPriceWatchOnce(bot: Telegraf): Promise<{ checked: number; notified: number }> {
  const watches = repo.listSteamPriceWatches();
  let notified = 0;

  for (const watch of watches) {
    const price = await fetchSteamPrice(watch.app_id);

    const previous = watch.final_price_minor;
    const current = price.finalPriceMinor;
    const target = watch.target_price_minor;
    const currentLowest = watch.lowest_price_minor;

    const shouldNotify = shouldNotifySteamPrice(previous, current, target);

    const newLowest = currentLowest > current ? current : currentLowest;

    if (shouldNotify) {
      const updatedWatch: repo.SteamPriceWatch = {
        ...watch,
        final_price_minor: current,
        initial_price_minor: price.initialPriceMinor,
        discount_percent: price.discountPercent,
        lowest_price_minor: newLowest,
      };
      await bot.telegram.sendMessage(config.tgChatId, formatSteamPriceAlert(updatedWatch), {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      });
      notified++;
    }

    repo.updateSteamPriceSnapshot(watch.id, current, price.initialPriceMinor, price.discountPercent, newLowest);
  }

  return { checked: watches.length, notified };
}
