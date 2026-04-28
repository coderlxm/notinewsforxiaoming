import { WeatherData } from '../fetchers/weather';
import { GameNews } from '../fetchers/games';

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

  const dayOfWeek = new Date().getDay();
  // getDay(): 0 为周日，1-5 为工作日，6 为周六
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (isWeekday) {
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


