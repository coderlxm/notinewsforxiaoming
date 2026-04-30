import { WeatherData } from '../fetchers/weather';
import { GameNews } from '../fetchers/games';
import { isChinaWorkday } from '../calendar/chinaWorkday';

export function formatTelegramMessage(weather: WeatherData | null, news: GameNews[]): string {
  let message = `📅 **每日简报** (${new Date().toLocaleDateString('zh-CN')})\n\n`;

  if (weather) {
    message += `🌤️ **今日天气**\n`;
    message += `天气: ${weather.text} | 温度: ${weather.temp}°C (体感 ${weather.feelsLike}°C)\n`;
    message += `风向: ${weather.windDir}\n\n`;
  }

  message += `🎮 **主机与PC游戏新闻 Top 5**\n`;
  if (news.length === 0) {
    message += `今日暂无相关新闻。\n`;
  } else {
    news.forEach((item, index) => {
      message += `${index + 1}. [${item.title}](${item.link})\n`;
    });
  }

  if (isChinaWorkday(new Date())) {
    message += `\n🚨 **打工人日常提醒** 🚨\n`;
    message += `💧 **多喝水！** 身体是革命的本钱，立刻去接一杯水！\n`;
    message += `⏱️ **记得打卡！** 上下班千万别忘了打卡，保卫工资！\n`;
  }

  return message;
}

export function formatGithubMessage(summary: string): string {
  let message = `🚀 **GitHub 今日趋势精选** (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += summary;
  message += `\n\n[查看更多热门项目](https://github.com/trending)`;
  return message;
}

export function formatSleepMessage(tip: string): string {
  let message = `🌙 **深夜睡眠提醒** (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += `现在已经是凌晨 **00:10** 啦！你是全宇宙最努力的打工人，但现在身体需要充电了。🔋\n\n`;
  message += `💡 **今日生活小常识：**\n${tip}\n\n`;
  message += `请立刻放下手机，闭上眼睛，做一个甜甜的梦。晚安！😴💤`;
  return message;
}

export function formatWakeupMessage(weather: WeatherData | null, quote: string): string {
  let message = `☀️ **早安，小明！** (${new Date().toLocaleDateString('zh-CN')})\n\n`;
  message += `${quote}\n\n`;

  if (weather) {
    message += `🌤️ **当前天气状态：**\n`;
    message += `${weather.text} | ${weather.temp}°C\n\n`;

    if (weather.text.includes('雨') || weather.text.includes('阴')) {
      message += `⚠️ **注意：今天有雨，出门记得带伞哦！** ☔\n\n`;
    }
  }

  message += `💪 加油，又是充满机遇的一天！别忘了打卡哦～`;
  return message;
}



