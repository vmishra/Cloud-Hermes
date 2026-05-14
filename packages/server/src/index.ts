import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { HOST, PORT, SERVER_VERSION } from './config';
import { registerWebSocket } from './ws/index';

/**
 * The Cloud Hermes orchestration server.
 *
 * It owns the WebSocket channel to the web client, the resource graph, the
 * skill catalog, the safety guard, and every side-effecting subprocess. This
 * entrypoint wires up the HTTP and WebSocket surface; the orchestration logic
 * is layered on in later build steps.
 */
const app = Fastify({ logger: true });

await app.register(websocket);

app.get('/health', async () => ({ status: 'ok', version: SERVER_VERSION }));

await registerWebSocket(app);

try {
  await app.listen({ host: HOST, port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
