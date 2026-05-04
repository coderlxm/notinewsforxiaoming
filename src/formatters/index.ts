import type { WeatherData } from '../fetchers/weather';
import type { GameNews } from '../fetchers/games';
import type { ServerHealthResult } from '../services/serverHealth';
import { isChinaWorkday } from '../calendar/chinaWorkday';
import { getCountdownInfo } from '../calendar/countdown';

function chinaDateLabel(): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(new Date());
}

function chinaWeekdayLabel(): string {
  const weekday = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short'
  }).format(new Date());
  return weekday;
}

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
  let message = `📅 <b>每日简报</b> (${chinaDateLabel()})\n\n`;

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
  let message = `🚀 <b>GitHub 今日趋势精选</b> (${chinaDateLabel()})\n\n`;
  message += renderMarkdownLikeAsHtml(summary);
  message += '\n\n<a href="https://github.com/trending">查看更多热门项目</a>';
  return message;
}

export function formatSleepMessage(tip: string): string {
  let message = `🌙 <b>深夜睡眠提醒</b> (${chinaDateLabel()})\n\n`;
  message += '现在已经是凌晨 <b>00:10</b> 啦！你是全宇宙最努力的打工人，但现在身体需要充电了。🔋\n\n';
  message += `💡 <b>今日生活小常识：</b>\n${renderMarkdownLikeAsHtml(tip)}\n\n`;
  message += '请立刻放下手机，闭上眼睛，做一个甜甜的梦。晚安！😴💤';
  return message;
}

export function formatWakeupMessage(weather: WeatherData | null, quote: string): string {
  let message = `☀️ <b>早安，小明！</b> (${chinaDateLabel()})\n\n`;
  const isWorkday = isChinaWorkday(new Date());

  if (weather) {
    message += '🌤️ <b>当前天气状态：</b>\n';
    message += `${escapeHtml(weather.text)} | ${escapeHtml(String(weather.temp))}°C\n\n`;

    if (isWorkday) {
      if (weather.text.includes('雨')) {
        message += '⚠️ <b>注意：今天有雨，出门记得带伞哦！</b> ☔\n\n';
      } else if (weather.text.includes('阴')) {
        message += '🌥️ <b>注意：今天阴天，可能有雨，建议带伞以防万一。</b> ☂️\n\n';
      }
    }
  }

  const countdown = getCountdownInfo();
  message += '\n⏳ <b>期待值回血中</b>\n';
  message += '---\n';
  if (countdown.isHolidayToday && countdown.currentHolidayName) {
    message += `🏝️ 正在享受<b>【${countdown.currentHolidayName}】</b>假期中！\n`;
  }
  if (countdown.holiday) {
    message += `🏝️ 距离<b>【${countdown.holiday.name}】</b>还有 <b>${countdown.holiday.days}</b> 天\n`;
  }
  if (countdown.gta6.days >= 0) {
    const gtaEmoji = countdown.gta6.isSoon ? '🔥' : '🎮';
    message += `${gtaEmoji} 距离<b>【GTA 6 发售】</b>还有 <b>${countdown.gta6.days}</b> 天\n`;
    if (countdown.gta6.isSoon) {
      message += '🚨 <b>冲刺阶段：</b>进入最后 30 天倒计时，准备开冲！\n';
    }
  } else {
    message += '🎮 <b>GTA 6 已发售，准备开玩！</b>\n';
  }

  message += `\n📝 <b>今日励志语录</b>\n${renderMarkdownLikeAsHtml(quote)}\n`;

  if (isWorkday) {
    message += '\n💪 加油，又是充满机遇的一天！别忘了打卡哦～';
  } else {
    message += '\n💪 加油，又是充满机遇的一天！好好享受假期吧～';
  }
  return message;
}

export function formatEnglishMessage(summary: string): string {
  let message = `🎓 <b>名师每日英语</b> (${chinaDateLabel()})\n\n`;
  message += renderMarkdownLikeAsHtml(summary);
  message += '\n\n#英语学习 #CET6 #碎片化';
  return message;
}

export function formatV2exMessage(summary: string): string {
  let message = `🚀 <b>V2EX 今日热议脱水总结</b> (${chinaDateLabel()})\n\n`;
  message += summary; // AI 已经输出了 HTML
  message += '\n\n#V2EX #社区热点 #深夜剧场';
  return message;
}

export function formatFitnessMessage(summary: string): string {
  let message = `🏋️‍♂️ <b>今日健身私教课</b> (${chinaDateLabel()} ${chinaWeekdayLabel()})\n\n`;
  message += summary;
  message += `\n\n#健身 #减脂 #健康生活`;
  return message;
}

export function formatVitaminMessage(): string {
  let message = `💊 <b>饭点维生素提醒</b> (${chinaDateLabel()} ${chinaWeekdayLabel()})\n\n`;
  message += '现在是饭点，记得把维生素一起吃掉。\n';
  message += '最好随餐服用，顺手喝点水，别让身体的后勤系统断供。';
  message += '\n\n#维生素 #健康提醒';
  return message;
}

export function formatServerHealthMessage(results: ServerHealthResult[]): string {
  const hasAbnormal = results.some(result => !result.online);
  let message = hasAbnormal
    ? `🔴 <b>服务器巡检发现异常</b> (${chinaDateLabel()} ${chinaWeekdayLabel()})\n\n`
    : `🟢 <b>服务器巡检正常</b> (${chinaDateLabel()} ${chinaWeekdayLabel()})\n\n`;

  results.forEach(result => {
    const target = result.target;
    const title = `${target.alias} - ${target.name}`;

    if (result.online) {
      message += `✅ <b>${escapeHtml(title)}</b>\n`;
      message += `用途: ${escapeHtml(target.role)}\n`;
      if (target.provider) message += `服务商: ${escapeHtml(target.provider)}\n`;
      if (target.note) message += `备注: ${escapeHtml(target.note)}\n`;
      message += `状态: 在线\n`;
      message += `主机名: ${escapeHtml(result.hostname ?? target.alias)}\n`;
      message += `运行: ${escapeHtml(result.uptime ?? '未知')}\n\n`;
      return;
    }

    message += `❌ <b>${escapeHtml(title)}</b>\n`;
    message += `用途: ${escapeHtml(target.role)}\n`;
    if (target.provider) message += `服务商: ${escapeHtml(target.provider)}\n`;
    if (target.note) message += `备注: ${escapeHtml(target.note)}\n`;
    message += `异常: ${escapeHtml(result.error ?? 'SSH 探测失败')}\n\n`;
  });

  message += '#服务器巡检 #健康检查';
  return message;
}
