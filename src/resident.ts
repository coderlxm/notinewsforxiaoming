import { createBot } from './bot/createBot.js';
import { registerInteractiveHandlers } from './bot/interactive.js';
import { schedulePendingReminders, schedulePendingRecurringRules } from './reminders/scheduler.js';
import { registerFixedJobs, restoreStartggPolling } from './scheduled/jobs.js';
import { restoreVitaminLoop } from './services/vitaminReminder.js';

async function main() {
  const bot = createBot();
  registerInteractiveHandlers(bot);
  schedulePendingReminders(bot);
  schedulePendingRecurringRules(bot);
  registerFixedJobs(bot);
  restoreStartggPolling(bot);
  restoreVitaminLoop(bot);

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
