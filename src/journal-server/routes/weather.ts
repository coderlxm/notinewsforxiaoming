import type { FastifyInstance } from 'fastify';
import type { JournalWeatherService } from '../weatherService.js';

export async function registerWeatherRoutes(
  server: FastifyInstance,
  service: JournalWeatherService,
): Promise<void> {
  server.get('/api/weather', async (_request, reply) => {
    reply.header('Cache-Control', 'no-cache');
    return await service.getCurrent();
  });
}
