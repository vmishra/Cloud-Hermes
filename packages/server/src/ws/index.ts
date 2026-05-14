import type { FastifyInstance } from 'fastify';
import type { RawData, WebSocket } from 'ws';
import { ClientMessage, type ServerMessage } from '@cloud-hermes/core';
import { SERVER_VERSION } from '../config';

/**
 * Registers the `/ws` WebSocket route — the single channel between the web
 * client and the server.
 *
 * Every inbound frame is validated against the shared `ClientMessage` schema
 * before it is acted on. For now the route round-trips the protocol; the
 * harness loop, approval flow, and abort path are wired up in later build
 * steps.
 */
export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    const send = (message: ServerMessage): void => {
      socket.send(JSON.stringify(message));
    };

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
        case 'approval_resolve':
        case 'abort':
          send({
            type: 'error',
            code: 'not-implemented',
            message: `'${message.type}' is not handled yet.`,
          });
          return;
      }
    });
  });
}
