import type { WeatherData } from '../fetchers/weather';
import type { GameNews } from '../fetchers/games';
import { isChinaWorkday } from '../calendar/chinaWorkday';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URL and fall back to '#'.
  }
  return '#';
}

function renderMarkdownLikeAsHtml(input: string): string {
  let html = escapeHtml(input);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, rawUrl: string) => {
    const safeUrl = escapeHtmlAttr(normalizeUrl(rawUrl));
    return `<a href="${safeUrl}">${label}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

export function formatTelegramMessage(weather: WeatherData | null, news: GameNews[]): string {
  let message = `📅 <b>每日简报</b> (${new Date().toLocaleDateString('zh-CN')})\n\n`;

  if (weather) {
    message += '🌤️ <b>今日天气</b>\n';
    message += `天气: ${escapeHtml(weather.text)} | 温度: ${escapeHtml(String(weather.temp))}°C (体感 ${escapeHtml(String(weather.feelsLike))}°C)\n`;
    message += `风向: ${escapeHtml(weather.windDir)}\n\n`;
  }

  message += '🎮 <b>主机与PC游戏新闻 Top 5</b>\n';
  if (news.length === 0) {
    message += `今日暂无相关新闻。\n`;
  } else {
    news.forEach((item, index) => {
      const title = escapeHtml(item.title);
      const link = escapeHtmlAttr(normalizeUrl(item.link));
      message += `${index + 1}. <a href="${link}">${title}</a>\n`;
    });
  }

  if (isChinaWorkday(new Date())) {
    message += '\n🚨 <b>打工人日常提醒</b> 🚨\n';
    message += '💧 <b>多喝水！</b> 身体是革命的本钱，立刻去接一杯水！\n';
    message += '⏱️ <b>记得打卡！</b> 上下班千万别忘了打卡，保卫工资！\n';
  }

  return message;
}

export function formatGithubMessage(summary: string): string {
  let message = `🚀 <b>GitHub 今日趋势精选</b> (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += renderMarkdownLikeAsHtml(summary);
  message += '\n\n<a href="https://github.com/trending">查看更多热门项目</a>';
  return message;
}

export function formatSleepMessage(tip: string): string {
  let message = `🌙 <b>深夜睡眠提醒</b> (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += '现在已经是凌晨 <b>00:10</b> 啦！你是全宇宙最努力的打工人，但现在身体需要充电了。🔋\n\n';
  message += `💡 <b>今日生活小常识：</b>\n${renderMarkdownLikeAsHtml(tip)}\n\n`;
  message += '请立刻放下手机，闭上眼睛，做一个甜甜的梦。晚安！😴💤';
  return message;
}

export function formatWakeupMessage(weather: WeatherData | null, quote: string): string {
  let message = `☀️ <b>早安，小明！</b> (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += `${renderMarkdownLikeAsHtml(quote)}\n\n`;

  if (weather) {
    message += '🌤️ <b>当前天气状态：</b>\n';
    message += `${escapeHtml(weather.text)} | ${escapeHtml(String(weather.temp))}°C\n\n`;

    if (weather.text.includes('雨')) {
      message += '⚠️ <b>注意：今天有雨，出门记得带伞哦！</b> ☔\n\n';
    } else if (weather.text.includes('阴')) {
      message += '🌥️ <b>注意：今天阴天，可能有雨，建议带伞以防万一。</b> ☂️\n\n';
    }
  }

  message += '💪 加油，又是充满机遇的一天！别忘了打卡哦～';
  return message;
}

export function formatEnglishMessage(summary: string): string {
  let message = `🎓 <b>名师每日英语</b> (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += renderMarkdownLikeAsHtml(summary);
  message += '\n\n#英语学习 #CET6 #碎片化';
  return message;
}
