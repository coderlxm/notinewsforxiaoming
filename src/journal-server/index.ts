import 'dotenv/config';
import { loadJournalServerConfig } from './config.js';
import { createJournalServer } from './server.js';

const config = loadJournalServerConfig();
const server = await createJournalServer(config);
await server.listen({ host: config.host, port: config.port });
