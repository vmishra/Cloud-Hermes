import { useEffect, useState } from 'react';
import { connectToServer, type ConnectionState } from './ws/client';

/**
 * The shell. For now it confirms the end-to-end pipe — web client to server
 * over the WebSocket — is alive. The dual-pane workspace, the operating-loop
 * stages, and the terminal view are built on top of this in later steps.
 */
export function App() {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [serverVersion, setServerVersion] = useState<string | null>(null);

  useEffect(() => {
    const connection = connectToServer({
      onState: setState,
      onConnected: setServerVersion,
    });
    return () => connection.close();
  }, []);

  const status =
    state === 'connected'
      ? `Connected to the server${serverVersion ? ` · v${serverVersion}` : ''}`
      : state === 'connecting'
        ? 'Connecting to the server'
        : 'Disconnected — retrying';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-neutral-50 text-neutral-900">
      <div className="text-center">
        <h1 className="text-2xl font-medium tracking-tight">Cloud Hermes</h1>
        <p className="mt-2 text-sm text-neutral-500">{status}</p>
      </div>
    </main>
  );
}
