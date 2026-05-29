import OpenAI from 'openai';
import { config } from '../config';
import type { GameNews } from '../fetchers/games';
import type { EnglishContent } from '../fetchers/english';
import type { V2exTopic } from '../fetchers/v2ex';
import type { FitnessContext } from '../services/fitness';

export async function summarizeNewsWithAI(newsList: GameNews[]): Promise<GameNews[]> {
  if (!config.deepseekApiKey) {
    console.log('DeepSeek API Key is not set. Skipping AI summary.');
    return newsList;
  }

  if (newsList.length === 0) return newsList;

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
请作为一名资深且幽默的游戏媒体编辑，对以下的新闻标题进行简要的中文润色和一句话看点提取。
要求：
1. 语言风格轻松幽默，加上适合的 Emoji。
2. 保持原意不变。
3. 返回格式必须是一行文字，不要有额外的解释。

新闻列表：
${newsList.map((n, i) => `[${i}] ${n.title}`).join('\n')}

请依次输出每个新闻的处理结果，格式为：
[0] 你的润色结果
[1] 你的润色结果
...
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    const aiContent = completion.choices[0].message.content || '';

    // 解析 AI 的输出，并覆盖到原数组中
    const lines = aiContent.split('\n');
    const summarizedNews = [...newsList];

    lines.forEach(line => {
      const match = line.match(/^\[(\d+)\]\s*(.*)/);
      if (match) {
        const index = parseInt(match[1]);
        const summary = match[2].trim();
        if (summarizedNews[index]) {
          summarizedNews[index].title = summary;
        }
      }
    });

    return summarizedNews;
  } catch (error) {
    console.error('Failed to summarize news with DeepSeek:', error);
    return newsList; // 发生错误时回退到原始新闻
  }
}

export async function summarizeGithubWithAI(repos: GithubRepo[]): Promise<string> {
  if (!config.deepseekApiKey || repos.length === 0) {
    return '暂无今日 GitHub 趋势。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
请作为一名资深的 Full Stack 工程师和技术博主，对以下 GitHub 今日热门项目进行解析。
要求：
1. 将项目名称和描述翻译成地道的中文。
2. 用一句话精准描述这个项目“解决了什么痛点”或“为什么值得关注”。
3. 保持专业且极客的语气。
4. 使用适当的技术类 Emoji。
5. 返回格式为 Telegram Markdown，包含链接。

项目列表：
${repos.map((n, i) => `${i + 1}. ${n.title}: ${n.description}`).join('\n')}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || 'AI 总结失败。';
  } catch (error) {
    console.error('Failed to summarize Github with DeepSeek:', error);
    return 'GitHub 趋势 AI 总结暂时不可用。';
  }
}

export async function generateLifeTipWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return '生活小贴士：多喝热水，早点睡觉。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = '请随机生成一条非常简短、实用、有趣的“生活小常识”或“健康小贴士”。要求：字数控制在 50 字以内，带上 1-2 个 Emoji，适合深夜阅读。';

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '生活小贴士：好梦！';
  } catch (error) {
    console.error('Failed to generate life tip with DeepSeek:', error);
    return '生活小贴士：放下手机，立刻闭眼。';
  }
}

export async function generateMorningQuoteWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return '早安！新的一天，加油！☀️';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = '请生成一段简短、充满力量、能让人瞬间清醒并感到温暖的晨间励志语录。要求：适合程序员阅读，带上 1-2 个积极的 Emoji，字数 40 字以内。';

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '加油，你是最棒的！☀️';
  } catch (error) {
    console.error('Failed to generate morning quote with DeepSeek:', error);
    return '早安！今天又是充满可能的一天。🚀';
  }
}

export async function teachEnglishWithAI(article: EnglishContent): Promise<string> {
  if (!config.deepseekApiKey) {
    return '名师英语教学暂时掉线，请稍后再试。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
Role: 你是一位拥有 20 年经验的资深英语老师，擅长将原版新闻作为教材。
Target: 你的学生是 CET-6 水平（词汇量 5000 左右），希望在 5 分钟内通过阅读原版资讯完成碎片化学习。
Input: 下面是一段来自 ${article.source} 的英语原文摘要：
Title: ${article.title}
Content: ${article.content}

Task:
请严格按以下格式输出教学内容（使用 Telegram Markdown 格式）：

1. 📖 **今日原文 (Selection)**:
   > (请精选并修正原文中的一小段地道表达，100词以内)

2. 💡 **重点词汇 (Key Vocabulary)**:
   * (单词/短语) [音标] - (中文含义，需包含在本句中的具体含义)
   * (再列举 2-3 个符合 CET-6 难度的词汇)

3. 🔍 **长难句拆解 (Sentence Analysis)**:
   * (从原文中提取 1 个长难句)
   * **解析**: (简明扼要地拆解语法结构，如定语从句、分词短语等)

4. 📝 **名师总结 (Summary)**:
   * (用中英双语简单概括这段内容的核心信息)

5. 🎓 **课后私语**:
   * (用一句鼓励性的英文话语结尾，并附带中文翻译)

注意：保持排版整洁，使用 Emoji 增加可读性。
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '老师今天累了，请明天再来。';
  } catch (error) {
    console.error('Failed to teach English with DeepSeek:', error);
    return '英语教学 AI 暂时不可用。';
  }
}

export async function generateEnglishFallbackWithAI(): Promise<string> {
  if (!config.deepseekApiKey) {
    return [
      '📖 **今日原文 (Selection)**:',
      '> "Small progress each day adds up to big results."',
      '',
      '💡 **重点词汇 (Key Vocabulary)**:',
      '* progress [ˈprɑːɡres] - 进步（逐步推进）',
      '* add up to - 累积成，最终达到',
      '* result [rɪˈzʌlt] - 结果',
      '',
      '🔍 **长难句拆解 (Sentence Analysis)**:',
      '* Small progress each day adds up to big results.',
      '* **解析**: 主语是 `Small progress each day`，谓语短语是 `adds up to`，宾语是 `big results`。',
      '',
      '📝 **名师总结 (Summary)**:',
      '* EN: Consistency matters more than speed.',
      '* 中: 每天一点点，坚持比速度更重要。',
      '',
      '🎓 **课后私语**:',
      '* Keep going, your future self will thank you.（坚持下去，未来的你会感谢现在的努力。）'
    ].join('\n');
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
你是一位资深英语老师。当前 RSS 抓取失败，请生成一份“替补版每日英语微课”，用于 CET-6 学习者的 5 分钟碎片学习。

请严格按以下 Telegram Markdown 结构输出：
1. 📖 **今日原文 (Selection)**: 选一句励志名言或常用表达（英文）
2. 💡 **重点词汇 (Key Vocabulary)**: 给出 3-5 个词或短语，含音标和中文义
3. 🔍 **长难句拆解 (Sentence Analysis)**: 给 1 句并做结构解析
4. 📝 **名师总结 (Summary)**: 中英双语概括
5. 🎓 **课后私语**: 一句鼓励性英文 + 中文
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '今日英语替补内容生成失败。';
  } catch (error) {
    console.error('Failed to generate English fallback with DeepSeek:', error);
    return [
      '📖 **今日原文 (Selection)**:',
      '> "Practice makes progress, not perfection."',
      '',
      '💡 **重点词汇 (Key Vocabulary)**:',
      '* practice [ˈpræktɪs] - 练习',
      '* progress [ˈprɑːɡres] - 进步',
      '* perfection [pərˈfekʃn] - 完美',
      '',
      '🔍 **长难句拆解 (Sentence Analysis)**:',
      '* Practice makes progress, not perfection.',
      '* **解析**: 主语 `Practice`，谓语 `makes`，宾语 `progress`，后置对比 `not perfection` 强调方向。',
      '',
      '📝 **名师总结 (Summary)**:',
      '* EN: Focus on improvement rather than being perfect.',
      '* 中: 学习关键在持续变好，而不是一开始就完美。',
      '',
      '🎓 **课后私语**:',
      '* One more page today is a better you tomorrow.（今天多学一页，明天就更强一点。）'
    ].join('\n');
  }
}

export async function summarizeV2exWithAI(topics: V2exTopic[]): Promise<string> {
  if (!config.deepseekApiKey || topics.length === 0) {
    return '今日 V2EX 暂无热点讨论。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const prompt = `
Role: 你是一位深谙 V2EX 社区文化、既能硬核聊技术又能深度剖析情感的人间清醒观察者。
Input: 下面是今日 V2EX 的热帖列表：
${topics.map(t => `- [${t.node}] ${t.title} (回复: ${t.replies})\n  链接: ${t.link}\n  内容摘要: ${t.content.slice(0, 300)}`).join('\n\n')}

Task:
请为用户生成一份“V2EX 今日热议脱水总结”。要求：

1. **先做内容过滤（强约束）**：
   - 明确过滤推广、广告、引流、软文、课程售卖、社群拉新、招聘外包导流等内容。
   - 标题或正文若明显以“求关注/加群/优惠/推广链接/导流”为主，直接忽略，不进入总结。
   - 不要在输出中为此类帖子提供曝光或二次传播。

2. **情感类话题特写 (Highest Priority)**：
   - 识别涉及 [缘分天空]、[酷爱]、[结婚]、[奇思妙想] 等情感、人际关系或生活感悟的帖子。
   - 对这类帖子进行深度拆解：原帖的纠结点在哪？评论区的核心矛盾是什么（如：全员劝分、三观碰撞）？有没有什么一针见血的神评论？
   - 内容允许详细，保持同理心但要清醒。

3. **其他热门分类**：
   - 将剩下的帖子按 [硬核技术]、[职场/搞钱]、[生活琐事] 等进行归类总结。
   - 保持精炼，一句话点出看点。

4. **输出要求**：
   - 输出纯文本 + Markdown 风格标记，不要输出任何 HTML 标签。
   - 可使用：**加粗**、\`code\`、[标题](完整链接)。
   - 分段和列表只使用换行、序号、短横线和 emoji。
   - 整体风格要犀利且有趣，像是在和老友深夜聊天。

注意：引用帖子时，请使用输入中提供的完整链接，格式为 [标题](完整链接)。禁止省略、截断或改写链接。
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || 'AI 总结失败。';
  } catch (error) {
    console.error('Failed to summarize V2EX with DeepSeek:', error);
    return 'V2EX 今日总结暂时不可用。';
  }
}

export async function generateFitnessPlanWithAI(dayOfWeek: number, weatherText: string, fitnessContext: FitnessContext): Promise<string> {
  if (!config.deepseekApiKey) {
    return '教练今天没带表，请稍后再试。';
  }

  const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: config.deepseekApiKey
  });

  const isRainy = weatherText.includes('雨');
  const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const dayLabel = dayLabels[dayOfWeek] || '未知日期';
  const { status, focusArea, bgmStyle, bgmKeyword } = fitnessContext;

  const prompt = `
Role: 你是一位非常有亲和力、极其注重动作安全性、擅长减脂训练的资深健身教练。
User: 小明（32岁，男性，身高 172cm, 体重 68kg，上班族，CET-6水平，希望动作简单安全，强度适中）。
Context: 
- 今天是: ${dayLabel}
- 当前训练等级: Level ${status.training_state.current_level}（1-100，等级越高可略微增加组数或缩短休息，但仍保持安全适中）
- 累计训练次数: ${status.training_state.total_completed}
- 上次训练日期: ${status.training_state.last_workout_date ?? '暂无记录'}
- 上次训练侧重: ${status.training_state.last_focus_area ?? '暂无记录'}
- 本次训练侧重: ${focusArea}
- 当前天气: ${weatherText} ${isRainy ? '(检测到恶劣天气，请优先制定【纯居家自重方案】)' : '(天气良好，可以前往健身房或户外)'}
- BGM 推荐风格: ${bgmStyle}
- BGM 搜索关键词: ${bgmKeyword}

Task:
请为小明制定一份 60 分钟的训练计划，严格按以下格式输出（使用 HTML 标签）：

1. 🔥 <b>今日目标</b>: (一句话概括)
2. 🏃 <b>第一阶段：动态热身</b> (10-15分钟): (列举 4 个动作，每个动作附带 10 字以内的简单说明)
3. 💪 <b>第二阶段：正式训练</b> (45-50分钟): 
   - 动作需简单、安全。
   - 每个动作标注：动作名、组数 x 次数、休息时间。
   - **注意：每个动作必须附带一句话的简要做法说明（严禁长篇大论，限 30 字以内）。**
4. 🎵 <b>教练推荐 BGM 风格</b>: ${bgmStyle}，关键词：<code>${bgmKeyword}</code>
5. 🥦 <b>教练饮食贴士</b>: (限 20 字以内)
6. 📢 <b>今日教练寄语</b>: (限 30 字以内)

注意：
- 本次必须避开上次训练侧重里已训练过的主要肌群，优先保证恢复。
- 根据 Level ${status.training_state.current_level} 小幅调整强度，不要突然加量。
- **总输出长度严禁超过 600 个汉字**。排版清晰，Emoji 适度，确保 Telegram 消息不会因过长而发送失败。
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'deepseek-v4-flash',
    });

    return completion.choices[0].message.content || '教练正在忙，请稍后刷新。';
  } catch (error) {
    console.error('Failed to generate fitness plan with DeepSeek:', error);
    return '健身计划生成暂时不可用。';
  }
}
