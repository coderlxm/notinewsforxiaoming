import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import { config } from '../config';

export interface Magnet {
  name: string;
  link: string;
  size: string;
  shareDate: string;
}

export interface AvMetadata {
  code: string | null;
  releaseDate: string | null;
  length: string | null;
  director: string | null;
  maker: string | null;
  publisher: string | null;
  series: string | null;
  genres: string[];
}

export interface AvParsedContent {
  coverUrl: string | null;
  metadata: AvMetadata;
  magnets: Magnet[];
  sampleImages: string[];
}

function parseSizeToGB(size: string): number {
  const match = size.trim().match(/^([\d.]+)\s*(GB|MB|TB)/i);
  if (!match || !match[1] || !match[2]) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return value * 1024;
  if (unit === 'GB') return value;
  if (unit === 'MB') return value / 1024;
  return 0;
}

export function parseAvContent(html: string): AvParsedContent {
  const $ = cheerio.load(html);

  // Cover URL from bigImage link
  const bigImageHref = $('a.bigImage').attr('href');
  const coverUrl = bigImageHref || $('img').first().attr('src') || null;

  // Metadata extraction
  const metadata: AvMetadata = {
    code: null,
    releaseDate: null,
    length: null,
    director: null,
    maker: null,
    publisher: null,
    series: null,
    genres: [],
  };

  $('p').each((_, p) => {
    const header = $(p).find('span.header').first();
    if (!header.length) return;

    const label = header.text().trim();
    // Clone to remove the header span, leaving only the value content
    const valueEl = $(p).clone();
    valueEl.find('span.header').remove();
    const rawValue = valueEl.text().trim();

    switch (label) {
      case '識別碼:':
        metadata.code = rawValue || null;
        break;
      case '發行日期:':
        metadata.releaseDate = rawValue || null;
        break;
      case '長度:':
        metadata.length = rawValue || null;
        break;
      case '導演:':
        metadata.director = $(p).find('a').first().text().trim() || null;
        break;
      case '製作商:':
        metadata.maker = $(p).find('a').first().text().trim() || null;
        break;
      case '發行商:':
        metadata.publisher = $(p).find('a').first().text().trim() || null;
        break;
      case '系列:':
        metadata.series = $(p).find('a').first().text().trim() || null;
        break;
    }
  });

  // Genres
  $('span.genre').each((_, el) => {
    const text = $(el).find('a').text().trim();
    if (text) metadata.genres.push(text);
  });

  // Magnets table
  const magnets: Magnet[] = [];
  const magnetHeader = $('h4').filter((_, el) => $(el).text().includes('磁力連結投稿'));
  if (magnetHeader.length) {
    const table = magnetHeader.nextAll('table').first();
    table.find('tr').each((i, tr) => {
      if (i === 0) return; // skip header row
      const tds = $(tr).find('td');
      if (tds.length < 3) return;
      const a = tds.eq(0).find('a');
      magnets.push({
        name: a.text().trim(),
        link: a.attr('href') || '',
        size: tds.eq(1).text().trim(),
        shareDate: tds.eq(2).text().trim(),
      });
    });
  }

  // Sample images
  const sampleImages: string[] = [];
  const sampleHeader = $('h4').filter((_, el) => $(el).text().includes('樣品圖像'));
  if (sampleHeader.length) {
    // Find all img elements after the sample header, up to the next h4 or end
    let current = sampleHeader.next();
    while (current.length && current.prop('tagName') !== 'H4') {
      if (current.prop('tagName') === 'IMG') {
        const src = $(current).attr('src');
        if (src) sampleImages.push(src);
      }
      // Also look for img inside current element
      current.find('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src) sampleImages.push(src);
      });
      current = current.next();
    }
  }

  return { coverUrl, metadata, magnets, sampleImages };
}

export function pickBestMagnet(magnets: Magnet[]): Magnet | null {
  if (magnets.length === 0) return null;

  const cnKeywords = ['字幕', '中字', '-C', 'CN', 'SUB'];
  const cnMagnets = magnets.filter((m) =>
    cnKeywords.some((kw) => m.name.toUpperCase().includes(kw.toUpperCase()))
  );

  const candidates = cnMagnets.length > 0 ? cnMagnets : magnets;

  // Prefer 4-10GB range
  const inRange = candidates.filter((m) => {
    const gb = parseSizeToGB(m.size);
    return gb >= 4 && gb <= 10;
  });

  if (inRange.length > 0) {
    return inRange.reduce((best, cur) =>
      parseSizeToGB(cur.size) > parseSizeToGB(best.size) ? cur : best
    );
  }

  // Fallback: largest by size
  return candidates.reduce((best, cur) =>
    parseSizeToGB(cur.size) > parseSizeToGB(best.size) ? cur : best
  );
}

export async function aiPickBestMagnet(magnets: Magnet[]): Promise<string | null> {
  if (!config.deepseekApiKey || magnets.length <= 1) return null;

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey,
  });

  const nameList = magnets.map((m) => `- ${m.name} (${m.size})`).join('\n');
  const prompt = `在以下磁力文件名中，哪一个是 1080P 或 4K 且明确带有中文字幕（如 -C, CN, SUB）的版本？请直接返回该名称，不要解释内容。\n\n${nameList}`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('AI magnet picker failed:', error);
    return null;
  }
}

export async function enhanceGenresWithAI(genres: string[]): Promise<string | null> {
  if (!config.deepseekApiKey || genres.length === 0) return null;

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey,
  });

  const genreList = genres.join(', ');
  const prompt = [
    '将以下 AV 标签翻译成简体中文，并按类型分组，自动匹配合适的 Emoji。',
    '输出格式示例：🎭 场景：#女教师 | 🍑 身材：#巨乳 | 🔥 玩法：#反差 #羞耻',
    '只输出格式化后的字符串，不要解释。',
    '',
    genreList,
  ].join('\n');

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('AI genre enhancement failed:', error);
    return null;
  }
}
