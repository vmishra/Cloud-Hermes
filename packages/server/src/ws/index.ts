import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { ClientMessage, type HarnessProvider, type ServerMessage } from '@cloud-hermes/core';
import { SERVER_VERSION } from '../config';
import { runTurn } from '../harness/index';

/**
 * Registers the `/ws` WebSocket route — the single channel between the web
 * client and the server.
 *
 * Every inbound frame is validated against the shared `ClientMessage` schema.
 * A `user_message` runs one reasoning turn through the harness; turns are
 * serialized per conversation so a second message cannot interleave with one
 * already in flight.
 */
export interface WebSocketDeps {
  /** The resolved reasoning provider, or null if none is available. */
  provider: HarnessProvider | null;
}

export async function registerWebSocket(
  app: FastifyInstance,
  deps: WebSocketDeps,
): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const send = (message: ServerMessage): void => {
      socket.send(JSON.stringify(message));
    };

    /** Conversation ids with a turn currently in flight on this connection. */
    const busy = new Set<string>();

    send({ type: 'connected', serverVersion: SERVER_VERSION });

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

        case 'approval_resolve':
        case 'abort':
          send({
            type: 'error',
            code: 'not-implemented',
            message: `'${message.type}' is handled in a later build step.`,
          });
          return;
      }
    });

    async function handleUserMessage(
      message: Extract<ClientMessage, { type: 'user_message' }>,
    ): Promise<void> {
      if (busy.has(message.conversationId)) {
        send({
          type: 'error',
          code: 'busy',
          message: 'A turn is already in progress for this conversation.',
        });
        return;
      }
      if (!deps.provider) {
        send({
          type: 'error',
          code: 'cli-not-found',
          message: 'No reasoning harness is available. Run the doctor preflight.',
        });
        return;
      }

      busy.add(message.conversationId);
      try {
        const turn = await runTurn(deps.provider, {
          mode: message.mode,
          userMessage: message.text,
        });
        if (turn.ok) {
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
  });
}
