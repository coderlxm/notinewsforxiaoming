import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';
import { JournalArticleService } from './articleService.js';
import { JournalAuth } from './auth.js';
import { openJournalDatabase } from './database.js';
import { JournalDeletionService } from './deletion.js';
import { JournalIngestService } from './ingest.js';
import {
  JournalImagePreviewBackfillService,
  JournalImagePreviewService,
} from './imagePreview.js';
import { JournalRepository } from './repository.js';
import { registerArticleRoutes } from './routes/articles.js';
import { registerFeedRoutes } from './routes/feeds.js';
import { registerInternalRoutes } from './routes/internal.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerPrivateEntryRoutes } from './routes/privateEntries.js';
import { registerPublicFeedRoutes } from './routes/publicFeed.js';
import { registerSiteProfileRoutes } from './routes/siteProfile.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { JournalSiteProfileService } from './siteProfileService.js';
import { JournalStorage } from './storage.js';
import { TelegramFileDownloader } from './telegramFiles.js';
import type { JournalServerConfig } from './types.js';
import { JournalWebEntryService } from './webEntryService.js';
import { JournalWeatherService } from './weatherService.js';

export async function createJournalServer(config: JournalServerConfig): Promise<FastifyInstance> {
  const server = Fastify({ logger: true });
  const database = openJournalDatabase(config.dataDir);
  const repository = new JournalRepository(database);
  const siteProfileService = new JournalSiteProfileService(repository);
  const weatherService = new JournalWeatherService(
    config.qweatherApiKey,
    config.qweatherCityId,
  );
  const auth = new JournalAuth(config.ingestToken, config.adminPassword);
  const storage = new JournalStorage(config.dataDir);
  const previews = new JournalImagePreviewService();
  const articleService = new JournalArticleService(repository, storage, previews);
  const webEntryService = new JournalWebEntryService(repository, storage, previews);
  const deletionService = new JournalDeletionService(repository, storage);
  const downloader = new TelegramFileDownloader(config.telegramToken);
  const ingestService = new JournalIngestService(
    config.allowedChatId,
    repository,
    storage,
    downloader,
    previews,
  );
  await new JournalImagePreviewBackfillService(repository, storage, previews).run();
  await siteProfileService.initialize(path.join(config.webRoot, 'avatar-ming.png'));

  await server.register(fastifyCookie, { secret: config.cookieSecret });
  await server.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await server.register(fastifyStatic, {
    root: config.webRoot,
    prefix: '/',
    wildcard: false,
    index: false,
  });

  server.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    const requestError = error as Error & { statusCode?: number };
    const statusCode = error instanceof ZodError
      ? 400
      : typeof requestError.statusCode === 'number'
        ? requestError.statusCode
        : 500;
    await reply.code(statusCode).send({ error: requestError.message });
  });

  server.get('/api/health', async () => {
    database.prepare('SELECT 1').get();
    return { status: 'ok' };
  });

  await registerInternalRoutes(server, { auth, deletionService, ingestService, repository });
  await registerPublicFeedRoutes(server, repository);
  await registerPrivateEntryRoutes(
    server,
    auth,
    repository,
    deletionService,
    webEntryService,
  );
  await registerArticleRoutes(server, auth, articleService);
  await registerMediaRoutes(server, auth, repository, config.dataDir);
  await registerSiteProfileRoutes(server, auth, siteProfileService);
  await registerWeatherRoutes(server, weatherService);
  await registerFeedRoutes(server, repository, siteProfileService, config.publicBaseUrl);

  const sendApplication = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html');
  };
  server.get('/', sendApplication);
  server.get('/p/:publicId', sendApplication);
  server.get('/me', sendApplication);
  server.get('/me/settings', sendApplication);
  server.get('/me/articles/new', sendApplication);
  server.get('/me/articles/:id/edit', sendApplication);
  server.get('/me/entries/new', sendApplication);
  server.get('/me/entries/:id/edit', sendApplication);

  server.addHook('onClose', async () => {
    database.close();
  });

  return server;
}
