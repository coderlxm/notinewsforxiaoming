import { MediaGroup } from '@dietime/telegraf-media-group';
import { Markup, type Context, type Telegraf } from 'telegraf';
import type { Message } from 'telegraf/types';
import type {
  JournalEntry,
  JournalVisibility,
} from '../shared/journalProtocol.js';
import { JournalApiClient, JournalClientError } from './client.js';
import { JournalCaptureSessionRepository } from './captureSessionRepository.js';
import type { RegisterJournalBotHandlersOptions } from './types.js';

const JOURNAL_COMMAND_PATTERN = /^\/(?:note|post)(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/i;
const JOURNAL_VISIBILITY_CALLBACK_PATTERN = /^journal:visibility:([0-9a-f-]{36}):(private|public)$/;
const JOURNAL_DELETE_CALLBACK_PATTERN = /^jd:(ask|confirm|cancel):([0-9a-f-]{36}):(p|r)$/;
const JOURNAL_COMMENT_CALLBACK_PATTERN = /^jc:(h|p):(\d+)$/;

const CAPTURABLE_MESSAGE_FIELDS = new Set([
  'text',
  'photo',
  'video',
  'video_note',
  'animation',
  'voice',
  'audio',
  'document',
  'sticker',
  'location',
  'venue',
  'contact',
  'poll',
  'checklist',
  'dice',
  'game',
  'story',
  'paid_media',
]);

function isAuthorized(ctx: Context, allowedChatId: string): boolean {
  return String(ctx.chat?.id) === allowedChatId;
}

function getMessageCommandText(message: Message): string | null {
  if ('text' in message) return message.text;
  if ('caption' in message && message.caption) return message.caption;
  return null;
}

function hasCommandBody(message: Message): boolean {
  const commandText = getMessageCommandText(message);
  if (!commandText) return false;
  const match = JOURNAL_COMMAND_PATTERN.exec(commandText);
  return Boolean(match?.[1]?.trim());
}

function getReplyMessage(message: Message): Message | null {
  if (!('reply_to_message' in message) || !message.reply_to_message) return null;
  return message.reply_to_message;
}

function getCaptionCommandVisibility(
  message: Message,
  botUsername: string,
): JournalVisibility | null {
  if (!('caption' in message) || !message.caption) return null;
  const match = /^\/(note|post)(?:@([A-Za-z0-9_]+))?(?:\s|$)/i.exec(message.caption);
  if (!match?.[1]) return null;
  if (match[2] && match[2].toLowerCase() !== botUsername.toLowerCase()) return null;
  return match[1].toLowerCase() === 'post' ? 'public' : 'private';
}

function getMediaGroupMessages(ctx: Context): Message[] | null {
  const mediaGroup = (ctx.update as typeof ctx.update & { media_group?: Message[] }).media_group;
  return Array.isArray(mediaGroup) && mediaGroup.length > 0 ? mediaGroup : null;
}

function getMediaGroupCommandVisibility(
  messages: Message[],
  botUsername: string,
): JournalVisibility | null {
  for (const message of messages) {
    const visibility = getCaptionCommandVisibility(message, botUsername);
    if (visibility) return visibility;
  }
  return null;
}

function isCapturableMessage(message: Message): boolean {
  const commandText = getMessageCommandText(message);
  if (commandText?.startsWith('/')) return false;
  const value = message as unknown as Record<string, unknown>;
  return [...CAPTURABLE_MESSAGE_FIELDS].some((field) => field in value);
}

function toRawMessage(message: Message): Record<string, unknown> {
  return message as unknown as Record<string, unknown>;
}

function formatVisibility(visibility: JournalVisibility): string {
  return visibility === 'public' ? '公开动态' : '私有笔记';
}

function formatResult(entry: Pick<JournalEntry, 'visibility'>, sourceMessageCount = 1): string {
  if (sourceMessageCount > 1) {
    return `已将相册中的 ${sourceMessageCount} 项保存为${formatVisibility(entry.visibility)}。`;
  }
  return `已保存为${formatVisibility(entry.visibility)}。`;
}

function buildResultButtons(
  entry: Pick<JournalEntry, 'publicId' | 'visibility'>,
  publicBaseUrl: string,
) {
  const targetVisibility: JournalVisibility = entry.visibility === 'public' ? 'private' : 'public';
  const visibilityLabel = targetVisibility === 'public' ? '🌐 设为公开' : '🔒 转为私有';
  const visibilityMarker = entry.visibility === 'public' ? 'p' : 'r';
  const siteUrl = entry.visibility === 'public'
    ? `${publicBaseUrl}/p/${entry.publicId}`
    : `${publicBaseUrl}/me`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        visibilityLabel,
        `journal:visibility:${entry.publicId}:${targetVisibility}`,
      ),
      Markup.button.url('🌍 打开网站', siteUrl),
    ],
    [Markup.button.callback('🗑 删除', `jd:ask:${entry.publicId}:${visibilityMarker}`)],
  ]);
}

function deleteConfirmationButtons(publicId: string, visibilityMarker: 'p' | 'r') {
  return Markup.inlineKeyboard([[
    Markup.button.callback('确认删除', `jd:confirm:${publicId}:${visibilityMarker}`),
    Markup.button.callback('取消', `jd:cancel:${publicId}:${visibilityMarker}`),
  ]]);
}

function visibilityFromMarker(marker: 'p' | 'r'): JournalVisibility {
  return marker === 'p' ? 'public' : 'private';
}

function commentNotificationKeyboard(commentId: number, hidden: boolean, adminUrl: string) {
  return Markup.inlineKeyboard([[
    Markup.button.url('打开管理', adminUrl),
    Markup.button.callback(
      hidden ? '恢复公开' : '隐藏评论',
      `jc:${hidden ? 'p' : 'h'}:${commentId}`,
    ),
  ]]);
}

export function registerJournalBotHandlers(
  bot: Telegraf,
  options: RegisterJournalBotHandlersOptions,
): void {
  const api = new JournalApiClient(options.apiBaseUrl, options.ingestToken);
  const sessions = new JournalCaptureSessionRepository(options.database);
  const publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');

  bot.use(new MediaGroup({ timeout: 1000 }).middleware());

  async function editPrompt(
    ctx: Context,
    promptMessageId: number,
    text: string,
    extra?: ReturnType<typeof Markup.inlineKeyboard>,
  ): Promise<void> {
    await ctx.telegram.editMessageText(
      String(ctx.chat!.id),
      promptMessageId,
      undefined,
      text,
      extra,
    );
  }

  async function saveMessages(
    ctx: Context,
    sourceMessages: Message[],
    visibility: JournalVisibility,
    promptMessageId: number,
    captureSession: boolean,
  ): Promise<void> {
    await editPrompt(ctx, promptMessageId, '正在保存到 Journal…');

    let entry: JournalEntry | null = null;
    for (const [index, sourceMessage] of sourceMessages.entries()) {
      try {
        entry = await api.ingest({
          requestId: `${String(ctx.chat!.id)}:${sourceMessage.message_id}`,
          visibility,
          chatId: String(ctx.chat!.id),
          message: toRawMessage(sourceMessage),
        });
      } catch (error) {
        if (!(error instanceof JournalClientError)) throw error;
        const item = sourceMessages.length > 1 ? `相册第 ${index + 1} 项` : '本条内容';
        await editPrompt(
          ctx,
          promptMessageId,
          `Journal 保存失败（${item}）：${error.message}`,
        );
        return;
      }
    }

    if (!entry) throw new Error('Journal source message list must not be empty.');

    if (captureSession) sessions.delete(String(ctx.chat!.id));
    await editPrompt(
      ctx,
      promptMessageId,
      formatResult(entry, sourceMessages.length),
      buildResultButtons(entry, publicBaseUrl),
    );
  }

  async function startCapture(ctx: Context, visibility: JournalVisibility): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const current = sessions.find(chatId);
    const promptText = `请发送下一条要保存为${formatVisibility(visibility)}的内容，或发送 /cancel 取消。`;

    if (current) {
      await editPrompt(ctx, current.promptMessageId, promptText);
      sessions.save({
        chatId,
        visibility,
        promptMessageId: current.promptMessageId,
      });
      return;
    }

    const prompt = await ctx.reply(promptText);
    sessions.save({
      chatId,
      visibility,
      promptMessageId: prompt.message_id,
    });
  }

  async function handleJournalCommand(
    ctx: Context,
    visibility: JournalVisibility,
    mediaGroupMessages: Message[] | null = null,
  ): Promise<void> {
    if (!isAuthorized(ctx, options.allowedChatId) || !ctx.message) return;
    const replyMessage = getReplyMessage(ctx.message);
    const isCaptionCommand = mediaGroupMessages
      ? getMediaGroupCommandVisibility(mediaGroupMessages, ctx.me) !== null
      : getCaptionCommandVisibility(ctx.message, ctx.me) !== null;
    const sourceMessages = replyMessage
      ? [replyMessage]
      : mediaGroupMessages
        ?? (isCaptionCommand || hasCommandBody(ctx.message) ? [ctx.message] : null);

    if (!sourceMessages) {
      await startCapture(ctx, visibility);
      return;
    }

    const captureSession = sessions.find(String(ctx.chat!.id));
    if (captureSession) {
      sessions.save({
        chatId: String(ctx.chat!.id),
        visibility,
        promptMessageId: captureSession.promptMessageId,
      });
      await saveMessages(
        ctx,
        sourceMessages,
        visibility,
        captureSession.promptMessageId,
        true,
      );
      return;
    }

    const prompt = await ctx.reply('准备保存到 Journal…');
    await saveMessages(ctx, sourceMessages, visibility, prompt.message_id, false);
  }

  bot.command('note', async (ctx) => {
    await handleJournalCommand(ctx, 'private');
  });

  bot.command('post', async (ctx) => {
    await handleJournalCommand(ctx, 'public');
  });

  bot.command('cancel', async (ctx, next) => {
    if (!isAuthorized(ctx, options.allowedChatId)) return;
    const session = sessions.find(String(ctx.chat!.id));
    if (!session) return next();

    sessions.delete(String(ctx.chat!.id));
    await editPrompt(ctx, session.promptMessageId, '已取消本次 Journal 记录。');
  });

  bot.on('message', async (ctx, next) => {
    if (!isAuthorized(ctx, options.allowedChatId)) return;
    const mediaGroupMessages = getMediaGroupMessages(ctx);
    const captionVisibility = mediaGroupMessages
      ? getMediaGroupCommandVisibility(mediaGroupMessages, ctx.me)
      : getCaptionCommandVisibility(ctx.message, ctx.me);
    if (captionVisibility) {
      await handleJournalCommand(ctx, captionVisibility, mediaGroupMessages);
      return;
    }

    const session = sessions.find(String(ctx.chat.id));
    if (!session || !isCapturableMessage(ctx.message)) return next();

    await saveMessages(
      ctx,
      mediaGroupMessages ?? [ctx.message],
      session.visibility,
      session.promptMessageId,
      true,
    );
  });

  bot.action(JOURNAL_VISIBILITY_CALLBACK_PATTERN, async (ctx) => {
    if (!isAuthorized(ctx, options.allowedChatId)) return;
    const match = JOURNAL_VISIBILITY_CALLBACK_PATTERN.exec(ctx.match[0]);
    if (!match?.[1] || (match[2] !== 'private' && match[2] !== 'public')) return;

    try {
      const entry = await api.updateVisibility(match[1], match[2]);
      await ctx.answerCbQuery(`已转为${formatVisibility(entry.visibility)}`);
      await ctx.editMessageText(
        formatResult(entry),
        buildResultButtons(entry, publicBaseUrl),
      );
    } catch (error) {
      if (!(error instanceof JournalClientError)) throw error;
      await ctx.answerCbQuery(`Journal 操作失败：${error.message}`, { show_alert: true });
    }
  });

  bot.action(JOURNAL_DELETE_CALLBACK_PATTERN, async (ctx) => {
    if (!isAuthorized(ctx, options.allowedChatId)) return;
    const match = JOURNAL_DELETE_CALLBACK_PATTERN.exec(ctx.match[0]);
    if (!match?.[1] || !match[2] || (match[3] !== 'p' && match[3] !== 'r')) return;
    const action = match[1];
    const publicId = match[2];
    const visibility = visibilityFromMarker(match[3]);

    if (action === 'ask') {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        '确认永久删除这条 Journal 记录及其附件？\n原始 Telegram 消息不会被删除。',
        deleteConfirmationButtons(publicId, match[3]),
      );
      return;
    }

    if (action === 'cancel') {
      await ctx.answerCbQuery('已取消删除');
      await ctx.editMessageText(
        formatResult({ visibility }),
        buildResultButtons({ publicId, visibility }, publicBaseUrl),
      );
      return;
    }

    try {
      await api.delete(publicId);
      await ctx.answerCbQuery('已删除 Journal 记录');
      await ctx.editMessageText('已删除此 Journal 记录。');
    } catch (error) {
      if (!(error instanceof JournalClientError)) throw error;
      await ctx.answerCbQuery(`Journal 删除失败：${error.message}`, { show_alert: true });
    }
  });

  bot.action(JOURNAL_COMMENT_CALLBACK_PATTERN, async (ctx) => {
    if (!isAuthorized(ctx, options.allowedChatId)) return;
    const match = JOURNAL_COMMENT_CALLBACK_PATTERN.exec(ctx.match[0]);
    if (!match?.[1] || !match[2]) return;
    const hidden = match[1] === 'h';
    const commentId = Number(match[2]);

    try {
      const response = await api.updateCommentStatus(commentId, hidden ? 'hidden' : 'published');
      await ctx.answerCbQuery(hidden ? '已隐藏该评论组' : '已恢复公开该评论组');
      await ctx.editMessageReplyMarkup(
        commentNotificationKeyboard(
          commentId,
          hidden,
          `${publicBaseUrl}/me?entry=${response.entryId}#comments`,
        ).reply_markup,
      );
    } catch (error) {
      if (!(error instanceof JournalClientError)) throw error;
      await ctx.answerCbQuery(`Journal 操作失败：${error.message}`, { show_alert: true });
    }
  });
}
