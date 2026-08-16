import path from 'node:path';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import { ZodError } from 'zod';
import { JournalAiSuggestionService } from './aiSuggestionService.js';
import { JournalArticleService } from './articleService.js';
import { JournalAuth } from './auth.js';
import { JournalContributionError } from './contributionError.js';
import { JournalContributionLinkService } from './contributionLinkService.js';
import { JournalContributionMediaService } from './contributionMedia.js';
import { JournalContributionNotificationService } from './contributionNotification.js';
import { JournalContributionService } from './contributionService.js';
import { openJournalDatabase } from './database.js';
import { JournalDeletionService } from './deletion.js';
import { JournalIngestService } from './ingest.js';
import {
  JournalImagePreviewBackfillService,
  JournalImagePreviewService,
} from './imagePreview.js';
import { JournalRepository } from './repository.js';
import {
  JournalResumePreviewBackfillService,
  JournalResumePreviewService,
} from './resumePreview.js';
import { JournalResumeService } from './resumeService.js';
import { registerArticleRoutes } from './routes/articles.js';
import { registerContributionRoutes } from './routes/contributions.js';
import { registerFeedRoutes } from './routes/feeds.js';
import { registerInternalRoutes } from './routes/internal.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerPrivateContributionRoutes } from './routes/privateContributions.js';
import { registerPrivateEntryRoutes } from './routes/privateEntries.js';
import { registerPublicDiscoveryRoutes } from './routes/publicDiscovery.js';
import { registerPublicFeedRoutes } from './routes/publicFeed.js';
import { registerResumeRoutes } from './routes/resume.js';
import { registerSiteProfileRoutes } from './routes/siteProfile.js';
import { registerTagSuggestionRoutes } from './routes/tagSuggestions.js';
import { registerTopicSuggestionRoutes } from './routes/topicSuggestions.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { JournalSiteProfileService } from './siteProfileService.js';
import { JournalStorage } from './storage.js';
import { TelegramFileDownloader } from './telegramFiles.js';
import type { JournalServerConfig } from './types.js';
import { JournalVideoNormalizationService } from './videoNormalization.js';
import {
  JournalVideoPreviewBackfillService,
  JournalVideoPreviewService,
} from './videoPreview.js';
import { JournalWebEntryService } from './webEntryService.js';
import { JournalWebEntryUploadService } from './webEntryUploadService.js';
import { JournalWeatherService } from './weatherService.js';

export async function createJournalServer(config: JournalServerConfig): Promise<FastifyInstance> {
  const server = Fastify({ logger: true });
  const database = openJournalDatabase(config.dataDir);
  const repository = new JournalRepository(database);
  const auth = new JournalAuth(config.ingestToken, config.adminPassword);
  const resumePreviews = new JournalResumePreviewService();
  const resumeService = new JournalResumeService(
    repository,
    auth,
    config.publicBaseUrl,
    resumePreviews,
  );
  const siteProfileService = new JournalSiteProfileService(repository, resumeService);
  const weatherService = new JournalWeatherService(
    config.qweatherApiKey,
    config.qweatherCityId,
  );
  const aiSuggestions = new JournalAiSuggestionService(config.deepseekApiKey);
  const storage = new JournalStorage(config.dataDir);
  await storage.initializeContributionStorage();
  const previews = new JournalImagePreviewService();
  const videoPreviews = new JournalVideoPreviewService();
  const videoNormalization = new JournalVideoNormalizationService(storage, videoPreviews);
  const articleService = new JournalArticleService(repository, storage, previews);
  const webEntryService = new JournalWebEntryService(repository, storage);
  const webEntryUploads = new JournalWebEntryUploadService(
    repository,
    storage,
    previews,
    videoNormalization,
  );
  const deletionService = new JournalDeletionService(repository, storage);
  const downloader = new TelegramFileDownloader(config.telegramToken);
  const contributionLinks = new JournalContributionLinkService(
    repository,
    config.publicBaseUrl,
  );
  const contributionService = new JournalContributionService(
    repository,
    storage,
    new JournalContributionMediaService(storage, videoNormalization),
  );
  const contributionNotifications = new JournalContributionNotificationService(
    config.telegramToken,
    config.allowedChatId,
    config.publicBaseUrl,
  );
  const ingestService = new JournalIngestService(
    config.allowedChatId,
    repository,
    storage,
    downloader,
    previews,
    videoPreviews,
  );
  await new JournalImagePreviewBackfillService(repository, storage, previews).run();
  await new JournalVideoPreviewBackfillService(repository, storage, videoPreviews).run();
  await new JournalResumePreviewBackfillService(repository, resumePreviews).run();
  await siteProfileService.initialize(path.join(config.webRoot, 'avatar-ming.png'));

  await server.register(fastifyCookie, { secret: config.cookieSecret });
  await server.register(fastifyMultipart, {
    limits: { fileSize: 20 * 1024 * 1024 },
  });
  await server.register(fastifyRateLimit, {
    global: false,
    max: 5,
    timeWindow: 60_000,
  });
  server.addContentTypeParser(
    'application/offset+octet-stream',
    (_request, _payload, done) => done(null),
  );
  await server.register(fastifyStatic, {
    root: config.webRoot,
    prefix: '/',
    wildcard: false,
    index: false,
  });

  server.setErrorHandler(async (error, request, reply) => {
    request.log.error(error);
    if (error instanceof JournalContributionError) {
      await reply.code(error.statusCode).send(error.response());
      return;
    }
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
  await registerContributionRoutes(server, {
    links: contributionLinks,
    contributions: contributionService,
    notifications: contributionNotifications,
    storage,
  });
  await registerPublicDiscoveryRoutes(server, auth, repository);
  await registerPublicFeedRoutes(server, auth, repository);
  await registerPrivateEntryRoutes(
    server,
    auth,
    repository,
    deletionService,
    webEntryService,
    webEntryUploads,
  );
  await registerTagSuggestionRoutes(server, auth, aiSuggestions);
  await registerTopicSuggestionRoutes(server, auth, aiSuggestions);
  webEntryUploads.registerRoutes(server);
  await registerArticleRoutes(server, auth, articleService);
  await registerMediaRoutes(server, auth, repository, config.dataDir);
  await registerPrivateContributionRoutes(server, {
    auth,
    links: contributionLinks,
    contributions: contributionService,
    repository,
    dataDir: config.dataDir,
  });
  await registerSiteProfileRoutes(server, auth, siteProfileService);
  await registerResumeRoutes(server, { auth, resumeService });
  await registerWeatherRoutes(server, weatherService);
  await registerFeedRoutes(server, repository, siteProfileService, config.publicBaseUrl);

  const sendApplication = async (_request: FastifyRequest, reply: FastifyReply) => {
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html');
  };
  server.get('/', sendApplication);

  server.get('/contribute', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
    return reply.sendFile('contribute.html');
  });

  server.setNotFoundHandler(async (request, reply) => {
    const pathname = new URL(request.url, config.publicBaseUrl).pathname;
    const isServerResource = pathname === '/api'
      || pathname.startsWith('/api/')
      || pathname === '/media'
      || pathname.startsWith('/media/')
      || path.extname(pathname) !== '';
    const isPageNavigation = (request.method === 'GET' || request.method === 'HEAD')
      && typeof request.headers.accept === 'string'
      && request.headers.accept.includes('text/html')
      && !isServerResource;
    if (isPageNavigation) {
      return sendApplication(request, reply);
    }
    return reply.code(404).send({
      message: `Route ${request.method}:${request.url} not found`,
      error: 'Not Found',
      statusCode: 404,
    });
  });

  server.addHook('onClose', async () => {
    database.close();
  });

  return server;
}
