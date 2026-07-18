import { escapeHtml } from '../utils/html.js';
import { bjFormat } from '../utils/time.js';
import type { SteamPriceWatch } from '../services/steamPriceRepository.js';

function formatPrice(minor: number): string {
  const yuan = Math.floor(minor / 100);
  const fen = minor % 100;
  return `¥${yuan}.${String(fen).padStart(2, '0')}`;
}

function steamStoreUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/?cc=CN&l=schinese`;
}

export function formatSteamPriceAddSuccess(
  watch: SteamPriceWatch,
  atTarget: boolean,
): string {
  const lines: string[] = [
    atTarget ? '已添加 Steam 价格监控（当前已到价）' : '已添加 Steam 价格监控',
    '──────────────────',
    escapeHtml(watch.name),
    `AppID: ${watch.app_id}`,
    '',
    `当前：${formatPrice(watch.final_price_minor)}${watch.discount_percent > 0 ? `（-${watch.discount_percent}%）` : ''}`,
    `原价：${formatPrice(watch.initial_price_minor)}`,
    `折扣：${watch.discount_percent}%`,
    `目标：${formatPrice(watch.target_price_minor)}`,
  ];
  if (atTarget) {
    lines.push(`自添加以来最低：${formatPrice(watch.lowest_price_minor)}`);
  }
  lines.push('');
  lines.push(`<a href="${steamStoreUrl(watch.app_id)}">在 Steam 查看</a>`);
  return lines.join('\n');
}

export function formatSteamPriceAlert(watch: SteamPriceWatch): string {
  return [
    '🎮 Steam 到价提醒',
    '──────────────────',
    escapeHtml(watch.name),
    '',
    `现价：${formatPrice(watch.final_price_minor)}${watch.discount_percent > 0 ? `（-${watch.discount_percent}%）` : ''}`,
    `原价：${formatPrice(watch.initial_price_minor)}`,
    `目标价：${formatPrice(watch.target_price_minor)}`,
    `自添加以来最低：${formatPrice(watch.lowest_price_minor)}`,
    '',
    `<a href="${steamStoreUrl(watch.app_id)}">在 Steam 查看</a>`,
  ].join('\n');
}

export function formatSteamPriceWatchList(watches: SteamPriceWatch[]): string {
  if (watches.length === 0) {
    return '当前没有 Steam 价格监控。';
  }
  const lines: string[] = ['Steam 价格监控列表'];
  watches.forEach((w) => {
    const recentRead = bjFormat(w.last_checked_at);
    lines.push(
      `#${w.id} ${escapeHtml(w.name)}`,
      `目标：${formatPrice(w.target_price_minor)}｜当前：${formatPrice(w.final_price_minor)}｜折扣：${w.discount_percent}%`,
      `自添加以来最低：${formatPrice(w.lowest_price_minor)}｜最近读取：${recentRead}`,
      '',
    );
  });
  return lines.join('\n').trimEnd();
}

export function formatSteamPriceSetTargetSuccess(id: number, newTargetMinor: number): string {
  return `已将订阅 #${id} 的目标价修改为 ${formatPrice(newTargetMinor)}。`;
}

export function formatSteamPriceRemoveSuccess(watch: SteamPriceWatch): string {
  return `已删除 Steam 价格监控：${escapeHtml(watch.name)}（#${watch.id}）。`;
}

export function formatSteamPriceHelp(): string {
  return [
    'Steam 价格监控管理',
    '• <code>/steam add &lt;Steam App URL | AppID&gt; &lt;目标价&gt;</code>',
    '• <code>/steam list</code>',
    '• <code>/steam set &lt;订阅ID&gt; &lt;新目标价&gt;</code>',
    '• <code>/steam remove &lt;订阅ID&gt;</code>',
    '• <code>/steam check</code>',
  ].join('\n');
}

export function formatSteamPriceCheckSummary(checked: number, notified: number): string {
  return `Steam 价格检查完成：检查 ${checked} 款，触发提醒 ${notified} 款。`;
}
