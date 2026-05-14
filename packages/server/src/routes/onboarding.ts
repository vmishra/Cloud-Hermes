import type { FastifyInstance } from 'fastify';
import {
  PROVIDER_PROFILES,
  runInsights,
  type HarnessProvider,
  type HarnessStatus,
  type OnboardingStatus,
  type ProviderId,
} from '@cloud-hermes/core';
import { createHarnessProvider } from '../harness/index';
import { syncState } from '../gcp/index';
import { checkAuthStatus, isValidProjectId, listProjects, setProject } from '../onboarding/index';
import { diagnose } from '../diagnostics/index';
import type { WorkspaceStore } from '../workspace/index';
import type { ConversationStore } from '../conversations/index';
import type { MemoryStore } from '../memory/index';

/**
 * Workspace and onboarding REST routes.
 *
 * Onboarding and the workspace-scoped reads — conversation history, memory —
 * are request/response, so they live on REST routes rather than the streaming
 * WebSocket channel. The one slow step, the first state sync, is its own
 * endpoint so the UI can show progress around it. Diagnose is here too, so an
 * operator can get guided help before a workspace even exists.
 */

export interface OnboardingRouteDeps {
  store: WorkspaceStore;
  conversations: ConversationStore;
  memory: MemoryStore;
  provider: HarnessProvider | null;
  troubleshootingKnowledge: string;
}

export async function registerOnboardingRoutes(
  app: FastifyInstance,
  deps: OnboardingRouteDeps,
): Promise<void> {
  app.get('/api/onboarding/status', async (): Promise<OnboardingStatus> => {
    const [gcloud, workspaces] = await Promise.all([checkAuthStatus(), deps.store.list()]);

    const harnesses: HarnessStatus[] = [];
    for (const id of Object.keys(PROVIDER_PROFILES) as ProviderId[]) {
      const provider = createHarnessProvider(PROVIDER_PROFILES[id]);
      const availability = await provider.checkAvailability();
      harnesses.push({
        id,
        installed: availability.available,
        ready: availability.available,
        detail: availability.available
          ? (availability.version ?? 'available')
          : (availability.reason ?? 'not found'),
      });
    }

    return { gcloud, harnesses, workspaces };
  });

  app.get('/api/onboarding/projects', async () => ({ projects: await listProjects() }));

  app.post('/api/onboarding/set-project', async (request, reply) => {
    const body = request.body as { projectId?: unknown };
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    if (!isValidProjectId(projectId)) {
      return reply.status(400).send({ error: 'That is not a valid Google Cloud project id.' });
    }
    if (!(await setProject(projectId))) {
      return reply.status(502).send({ error: 'gcloud could not set the project.' });
    }
    return { ok: true, projectId };
  });

  app.get('/api/workspaces', async () => ({ workspaces: await deps.store.list() }));

  app.post('/api/workspaces', async (request, reply) => {
    const body = request.body as { name?: unknown; projectId?: unknown; harness?: unknown };
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const projectId = typeof body?.projectId === 'string' ? body.projectId.trim() : '';
    const harness = body?.harness;

    if (name === '') {
      return reply.status(400).send({ error: 'A workspace name is required.' });
    }
    if (!isValidProjectId(projectId)) {
      return reply.status(400).send({ error: 'That is not a valid Google Cloud project id.' });
    }
    if (harness !== 'claude' && harness !== 'gemini') {
      return reply.status(400).send({ error: 'harness must be "claude" or "gemini".' });
    }

    const workspace = await deps.store.create({ name, projectId, harness });
    return reply.status(201).send({ workspace });
  });

  app.post('/api/workspaces/:id/sync', async (request, reply) => {
    const { id } = request.params as { id: string };
    const workspace = await deps.store.load(id);
    if (workspace === null) {
      return reply.status(404).send({ error: 'Workspace not found.' });
    }

    const { graph, raw } = await syncState(workspace.projectId);
    await deps.store.saveGraph(id, graph, raw);
    return {
      syncedAt: graph.syncedAt,
      nodeCount: graph.nodes.length,
      slices: graph.slices,
    };
  });

  app.get('/api/workspaces/:id/insights', async (request, reply) => {
    const { id } = request.params as { id: string };
    const graph = await deps.store.loadGraph(id);
    if (graph === null) {
      return reply
        .status(404)
        .send({ error: 'No synced state for this workspace yet — run a sync first.' });
    }
    return { syncedAt: graph.syncedAt, insights: runInsights(graph) };
  });

  app.get('/api/workspaces/:id/conversations', async (request) => {
    const { id } = request.params as { id: string };
    return { conversations: await deps.conversations.list(id) };
  });

  app.get('/api/workspaces/:id/conversations/:conversationId', async (request, reply) => {
    const { id, conversationId } = request.params as { id: string; conversationId: string };
    const markdown = await deps.conversations.load(id, conversationId);
    if (markdown === null) {
      return reply.status(404).send({ error: 'Conversation not found.' });
    }
    return { id: conversationId, markdown };
  });

  app.post('/api/onboarding/diagnose', async (request, reply) => {
    const body = request.body as { errorText?: unknown };
    const errorText = typeof body?.errorText === 'string' ? body.errorText.trim() : '';
    if (errorText === '') {
      return reply.status(400).send({ error: 'Paste the error or log you are seeing.' });
    }
    if (deps.provider === null) {
      return reply.status(503).send({ error: 'No reasoning harness is available.' });
    }
    // Pre-workspace: the diagnosis is grounded in the gcloud-configured project.
    const turn = await diagnose(deps.provider, {
      errorText,
      knowledge: deps.troubleshootingKnowledge,
      workspace: null,
    });
    if (!turn.ok) {
      return reply.status(502).send({ error: turn.message });
    }
    return { response: turn.response };
  });

  app.get('/api/workspaces/:id/memory', async (request) => {
    const { id } = request.params as { id: string };
    return { content: await deps.memory.read(id) };
  });

  app.put('/api/workspaces/:id/memory', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { content?: unknown };
    if (typeof body?.content !== 'string') {
      return reply.status(400).send({ error: 'A string "content" field is required.' });
    }
    await deps.memory.write(id, body.content);
    return { ok: true };
  });
}
