import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConversationMode, HermesResponse } from '@cloud-hermes/core';
import { connectToServer, type Connection, type ConnectionState } from './ws/client';
import { ResponseView } from './ResponseView';

/**
 * The shell. A minimal conversation surface that drives one reasoning turn
 * end to end — message in, structured HermesResponse out. The dual-pane
 * workspace, operating-loop stages, and terminal view are built on top of
 * this in later steps.
 */

type Entry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'hermes'; response: HermesResponse }
  | { id: number; role: 'error'; text: string };

export function App() {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [mode, setMode] = useState<ConversationMode>('converse');
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);

  const conversationId = useMemo(() => crypto.randomUUID(), []);
  const connectionRef = useRef<Connection | null>(null);
  const nextId = useRef(0);
  const newId = () => (nextId.current += 1);

  useEffect(() => {
    const connection = connectToServer({
      onState: setState,
      onConnected: setServerVersion,
      onMessage: (message) => {
        if (message.type === 'hermes_response') {
          setEntries((prev) => [...prev, { id: newId(), role: 'hermes', response: message.response }]);
          setBusy(false);
        } else if (message.type === 'error') {
          setEntries((prev) => [...prev, { id: newId(), role: 'error', text: `${message.code}: ${message.message}` }]);
          setBusy(false);
        }
      },
    });
    connectionRef.current = connection;
    return () => connection.close();
  }, []);

  const send = () => {
    const text = draft.trim();
    if (!text || busy || state !== 'connected') return;
    const sent = connectionRef.current?.send({
      type: 'user_message',
      conversationId,
      mode,
      text,
    });
    if (!sent) return;
    setEntries((prev) => [...prev, { id: newId(), role: 'user', text }]);
    setDraft('');
    setBusy(true);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <span className="text-sm font-medium tracking-tight">Cloud Hermes</span>
        <span className="text-xs text-neutral-500">
          {state === 'connected'
            ? `connected${serverVersion ? ` · v${serverVersion}` : ''}`
            : state === 'connecting'
              ? 'connecting'
              : 'disconnected — retrying'}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-8">
        {entries.length === 0 && (
          <p className="my-auto text-center text-sm text-neutral-400">
            Ask about the project, or describe a change.
          </p>
        )}

        {entries.map((entry) => (
          <div key={entry.id}>
            {entry.role === 'user' && (
              <div className="ml-auto max-w-[80%] rounded-lg bg-neutral-900 px-3 py-2 text-sm text-neutral-50">
                {entry.text}
              </div>
            )}
            {entry.role === 'hermes' && (
              <div className="max-w-[90%] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <ResponseView response={entry.response} />
              </div>
            )}
            {entry.role === 'error' && (
              <div className="max-w-[90%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {entry.text}
              </div>
            )}
          </div>
        ))}

        {busy && <div className="text-sm text-neutral-400">Thinking…</div>}
      </main>

      <footer className="border-t border-neutral-200 px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <div className="flex gap-1 text-xs">
            {(['converse', 'create'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded px-2 py-1 ${
                  mode === m ? 'bg-neutral-900 text-neutral-50' : 'bg-neutral-200 text-neutral-600'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              rows={2}
              className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || state !== 'connected' || draft.trim() === ''}
              className="self-end rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-50 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
