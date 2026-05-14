import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { HOST, PORT, SERVER_VERSION, SKILLS_DIR, WORKSPACES_DIR } from './config';
import { resolveProvider } from './harness/index';
import { createWorkspaceStore } from './workspace/index';
import { createConversationStore } from './conversations/index';
import { createMemoryStore } from './memory/index';
import { loadSkillCatalog } from './skills/index';
import { loadTroubleshootingKnowledge } from './diagnostics/index';
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
const conversations = createConversationStore(WORKSPACES_DIR);
const memory = createMemoryStore(WORKSPACES_DIR);

const catalog = await loadSkillCatalog([SKILLS_DIR]);
app.log.info(`Loaded ${catalog.skills.size} skill(s) from the catalog.`);
for (const { path, error } of catalog.errors) {
  app.log.warn(`Skill not loaded — ${path}: ${error}`);
}

const troubleshootingKnowledge = await loadTroubleshootingKnowledge(SKILLS_DIR);

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

await registerOnboardingRoutes(app, {
  store,
  conversations,
  memory,
  provider,
  troubleshootingKnowledge,
});
await registerWebSocket(app, {
  provider,
  store,
  catalog,
  conversations,
  memory,
  troubleshootingKnowledge,
});

try {
  await app.listen({ host: HOST, port: PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
