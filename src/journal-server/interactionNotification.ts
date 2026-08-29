import { Telegraf } from 'telegraf';

export interface JournalCommentNotificationInput {
  entryId: number;
  entryTitle: string | null;
  entryExcerpt: string;
  authorName: string;
  content: string;
  createdAt: string;
  commentId: number;
}

const notificationTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function truncatePlainText(value: string, maxLength: number): string {
  const flat = value.replace(/\s+/gu, ' ').trim();
  const characters = [...flat];
  return characters.length > maxLength
    ? `${characters.slice(0, maxLength).join('')}…`
    : flat;
}

export class JournalCommentNotificationService {
  private readonly bot: Telegraf;
  private readonly publicBaseUrl: string;

  constructor(
    token: string,
    private readonly chatId: string,
    publicBaseUrl: string,
  ) {
    this.bot = new Telegraf(token);
    this.publicBaseUrl = publicBaseUrl.replace(/\/$/, '');
  }

  async notifyNewComment(input: JournalCommentNotificationInput): Promise<void> {
    const subject = input.entryTitle !== null
      ? input.entryTitle
      : truncatePlainText(input.entryExcerpt, 40);
    const message = [
      '💬 Journal 收到新评论',
      '',
      `条目：${subject}`,
      `访客：${input.authorName}`,
      `内容：${truncatePlainText(input.content, 80)}`,
      `时间：${notificationTimeFormatter.format(new Date(input.createdAt))}`,
    ].join('\n');
    await this.bot.telegram.sendMessage(this.chatId, message, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '打开管理',
            url: `${this.publicBaseUrl}/me?entry=${input.entryId}#comments`,
          },
          {
            text: '隐藏评论',
            callback_data: `jc:h:${input.commentId}`,
          },
        ]],
      },
    });
  }
}
