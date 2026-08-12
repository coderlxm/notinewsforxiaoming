import { createBot } from './bot/createBot.js';
import { registerInteractiveHandlers } from './bot/interactive.js';
import { config } from './config/index.js';
import { registerJournalBotHandlers } from './journal-bot/index.js';
import { getDb } from './reminders/db.js';
import { schedulePendingReminders, schedulePendingRecurringRules } from './reminders/scheduler.js';
import { registerFixedJobs, restoreStartggPolling } from './scheduled/jobs.js';
import { restoreVitaminLoop } from './services/vitaminReminder.js';
import { closeExpiredWorkCheckin } from './services/workCheckinReminder.js';

async function main() {
  if (!config.journalApiBaseUrl || !config.journalIngestToken || !config.journalPublicBaseUrl) {
    throw new Error('Journal bot configuration is incomplete.');
  }
  const bot = createBot();
  registerJournalBotHandlers(bot, {
    apiBaseUrl: config.journalApiBaseUrl,
    ingestToken: config.journalIngestToken,
    publicBaseUrl: config.journalPublicBaseUrl,
    allowedChatId: config.tgChatId,
    database: getDb(),
  });
  registerInteractiveHandlers(bot);
  schedulePendingReminders(bot);
  schedulePendingRecurringRules(bot);
  registerFixedJobs(bot);
  restoreStartggPolling(bot);
  restoreVitaminLoop(bot);
  await closeExpiredWorkCheckin(bot);

  bot.launch({
    allowedUpdates: ['message', 'callback_query'],
    dropPendingUpdates: false
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  console.log('Bot started. Long polling for updates...');
}

main().catch(error => {
  console.error('Resident bot encountered an error:', error);
  process.exit(1);
});
