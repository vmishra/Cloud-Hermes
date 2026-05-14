import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import {
  ClientMessage,
  fenceMemory,
  renderResponseMarkdown,
  summarizeGraph,
  type ApprovalCard,
  type HarnessProvider,
  type ServerMessage,
} from '@cloud-hermes/core';
import { SERVER_VERSION } from '../config';
import { runTurn } from '../harness/index';
import { buildSkillsSection, type SkillCatalog } from '../skills/index';
import { runExecution } from '../execution/index';
import type { WorkspaceStore } from '../workspace/index';
import type { ConversationStore } from '../conversations/index';
import type { MemoryStore } from '../memory/index';

/**
 * Registers the `/ws` WebSocket route — the single channel between the web
 * client and the server.
 *
 * A `user_message` runs one reasoning turn grounded in the workspace's synced
 * state, with create-mode progressive skill loading. An `execute_plan` runs the
 * chosen execution path; the direct path pauses on a blast-radius approval card
 * — a per-conversation pending promise the operator resolves — and is
 * fail-closed: a disconnect, an abort, or the connection closing denies every
 * pending approval. Turns and executions are serialized per conversation.
 */
export interface WebSocketDeps {
  provider: HarnessProvider | null;
  store: WorkspaceStore;
  catalog: SkillCatalog;
  conversations: ConversationStore;
  memory: MemoryStore;
}

export async function registerWebSocket(
  app: FastifyInstance,
  deps: WebSocketDeps,
): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const send = (message: ServerMessage): void => {
      socket.send(JSON.stringify(message));
    };

    /** Conversation ids with a turn or execution currently in flight. */
    const busy = new Set<string>();
    /** Pending approval resolvers, keyed by approval id. */
    const pendingApprovals = new Map<string, (decision: 'approved' | 'denied') => void>();

    /** Fail-closed: resolve every pending approval to denied. */
    const denyAllPending = (): void => {
      for (const resolve of pendingApprovals.values()) resolve('denied');
      pendingApprovals.clear();
    };

    send({ type: 'connected', serverVersion: SERVER_VERSION });

    socket.on('close', denyAllPending);

    socket.on('message', (raw: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        send({ type: 'error', code: 'invalid-json', message: 'Message was not valid JSON.' });
        return;
      }

      const result = ClientMessage.safeParse(parsed);
      if (!result.success) {
        send({
          type: 'error',
          code: 'protocol-mismatch',
          message: 'Message did not match the client protocol.',
        });
        return;
      }

      const message = result.data;
      switch (message.type) {
        case 'ping':
          send({ type: 'pong' });
          return;
        case 'user_message':
          void handleUserMessage(message);
          return;
        case 'execute_plan':
          void handleExecutePlan(message);
          return;
        case 'approval_resolve': {
          const resolve = pendingApprovals.get(message.approvalId);
          if (resolve !== undefined) resolve(message.decision);
          return;
        }
        case 'abort':
          // A new intent supersedes anything awaiting approval — fail closed.
          denyAllPending();
          return;
      }
    });

    async function handleUserMessage(
      message: Extract<ClientMessage, { type: 'user_message' }>,
    ): Promise<void> {
      if (busy.has(message.conversationId)) {
        send({ type: 'error', code: 'busy', message: 'A turn is already in progress.' });
        return;
      }
      if (deps.provider === null) {
        send({
          type: 'error',
          code: 'cli-not-found',
          message: 'No reasoning harness is available. Run the doctor preflight.',
        });
        return;
      }

      busy.add(message.conversationId);
      try {
        // Persistence and memory are enhancements — a failure here never blocks
        // the turn.
        await deps.conversations
          .recordUser(message.workspaceId, message.conversationId, message.text)
          .catch(() => undefined);

        const [graph, memoryText] = await Promise.all([
          deps.store.loadGraph(message.workspaceId),
          deps.memory.read(message.workspaceId),
        ]);
        const stateSummary = graph !== null ? summarizeGraph(graph) : undefined;
        const userMemory = fenceMemory(memoryText);

        const turn = await runTurn(deps.provider, {
          mode: message.mode,
          userMessage: message.text,
          userMemory: userMemory === '' ? undefined : userMemory,
          stateSummary,
          // Create mode gets progressive skill loading; converse mode does not.
          buildSkillsSection:
            message.mode === 'create'
              ? (ids) => buildSkillsSection(deps.catalog, ids)
              : undefined,
        });

        if (turn.ok) {
          await deps.conversations
            .recordHermes(
              message.workspaceId,
              message.conversationId,
              renderResponseMarkdown(turn.response),
            )
            .catch(() => undefined);
          send({
            type: 'hermes_response',
            conversationId: message.conversationId,
            response: turn.response,
          });
        } else {
          send({ type: 'error', code: turn.code, message: turn.message });
        }
      } catch (err) {
        send({
          type: 'error',
          code: 'internal',
          message: err instanceof Error ? err.message : 'The reasoning step failed.',
        });
      } finally {
        busy.delete(message.conversationId);
      }
    }

    async function handleExecutePlan(
      message: Extract<ClientMessage, { type: 'execute_plan' }>,
    ): Promise<void> {
      if (busy.has(message.conversationId)) {
        send({ type: 'error', code: 'busy', message: 'A turn is already in progress.' });
        return;
      }

      busy.add(message.conversationId);
      try {
        const policy = await deps.store.loadPolicy(message.workspaceId);
        await runExecution({
          path: message.path,
          steps: message.steps,
          conversationId: message.conversationId,
          workspaceId: message.workspaceId,
          catalog: deps.catalog,
          store: deps.store,
          policy,
          emit: send,
          requestApproval: (card: ApprovalCard) =>
            new Promise<'approved' | 'denied'>((resolve) => {
              pendingApprovals.set(card.approvalId, (decision) => {
                pendingApprovals.delete(card.approvalId);
                resolve(decision);
              });
              send({ type: 'approval_required', conversationId: message.conversationId, card });
            }),
        });
      } catch (err) {
        send({
          type: 'error',
          code: 'internal',
          message: err instanceof Error ? err.message : 'The execution failed.',
        });
      } finally {
        busy.delete(message.conversationId);
      }
    }
  });
}
