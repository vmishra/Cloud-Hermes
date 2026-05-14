import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { HOST, PORT, SERVER_VERSION, WORKSPACES_DIR } from './config';
import { resolveProvider } from './harness/index';
import { createWorkspaceStore } from './workspace/index';
import { registerOnboardingRoutes } from './routes/onboarding';
import { registerWebSocket } from './ws/index';

/**
 * The Cloud Hermes orchestration server.
 *
 * It owns the WebSocket channel to the web client, the workspace store, the
 * resource graph, the skill catalog, the safety guard, and every side-effecting
 * subprocess. This entrypoint wires up the HTTP and WebSocket surface and
 * resolves the reasoning harness; the rest is layered on in later build steps.
 */
const app = Fastify({ logger: true });

await app.register(websocket);

const store = createWorkspaceStore(WORKSPACES_DIR);

const provider = await resolveProvider();
if (provider) {
  app.log.info(`Reasoning harness: ${provider.profile.displayName}`);
} else {
  app.log.warn('No reasoning harness available — run the doctor preflight.');
}

app.get('/health', async () => ({
  status: 'ok',
  version: SERVER_VERSION,
  harness: provider?.profile.id ?? null,
}));

await registerOnboardingRoutes(app, { store });
await registerWebSocket(app, { provider });

try {
  await app.listen({ host: HOST, port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
