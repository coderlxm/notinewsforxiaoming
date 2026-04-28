import dotenv from 'dotenv';
dotenv.config();

export const config = {
  tgToken: process.env.TG_TOKEN || '',
  tgChatId: process.env.TG_CHAT_ID || '',
  qweatherApiKey: process.env.QWEATHER_API_KEY || '',
  qweatherCityId: process.env.QWEATHER_CITY_ID || '', // 默认为北京: 101010100
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
};
