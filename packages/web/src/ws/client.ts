import { ServerMessage } from '@cloud-hermes/core';

/**
 * The WebSocket client. Validates every inbound frame against the shared
 * `ServerMessage` schema and reconnects on drop, so the connection is a fact
 * the rest of the app can rely on rather than something it manages.
 */

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

type Handlers = {
  onState: (state: ConnectionState) => void;
  onConnected?: (serverVersion: string) => void;
  onMessage?: (message: ServerMessage) => void;
};

export type Connection = { close: () => void };

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const RETRY_DELAY_MS = 1500;

export function connectToServer(handlers: Handlers): Connection {
  let socket: WebSocket | null = null;
  let closed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const open = (): void => {
    if (closed) return;
    handlers.onState('connecting');
    socket = new WebSocket(WS_URL);

    socket.onopen = () => handlers.onState('connected');

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      const result = ServerMessage.safeParse(parsed);
      if (!result.success) return;
      const message = result.data;
      if (message.type === 'connected') handlers.onConnected?.(message.serverVersion);
      handlers.onMessage?.(message);
    };

    socket.onclose = () => {
      if (closed) return;
      handlers.onState('disconnected');
      retryTimer = setTimeout(open, RETRY_DELAY_MS);
    };

    socket.onerror = () => socket?.close();
  };

  open();

  return {
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
