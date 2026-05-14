import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ApprovalCard,
  ConversationMode,
  ExecutionCommand,
  ExecutionPath,
  HermesResponse,
  Insight,
  PlanStep,
  TerraformFile,
  Workspace,
} from '@cloud-hermes/core';
import { connectToServer, type Connection, type ConnectionState } from './ws/client';
import { ResponseView } from './ResponseView';
import { InsightsView } from './InsightsView';
import { CommandsView, TerraformView, ApprovalCardView, TerminalLog } from './ExecutionViews';
import { api } from './api/client';

/**
 * The conversation surface for a workspace. Drives a reasoning turn, an
 * on-demand project review, and the three plan-execution paths — including the
 * human-in-the-loop approval card and the live terminal log. The dual-pane
 * workspace layout and the xterm.js terminal drawer come with the design pass.
 */

type Entry =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'hermes'; response: HermesResponse }
  | { id: number; role: 'insights'; insights: Insight[] }
  | { id: number; role: 'commands'; commands: ExecutionCommand[] }
  | { id: number; role: 'terraform'; files: TerraformFile[] }
  | { id: number; role: 'approval'; card: ApprovalCard; resolved: 'approved' | 'denied' | null }
  | { id: number; role: 'result'; ok: boolean; summary: string }
  | { id: number; role: 'error'; text: string };

export function Conversation({ workspace }: { workspace: Workspace }) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [mode, setMode] = useState<ConversationMode>('converse');
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [terminalLog, setTerminalLog] = useState('');
  const [busy, setBusy] = useState(false);

  const conversationId = useMemo(() => crypto.randomUUID(), []);
  const connectionRef = useRef<Connection | null>(null);
  const nextId = useRef(0);
  const newId = () => (nextId.current += 1);
  const append = (entry: Entry) => setEntries((prev) => [...prev, entry]);

  useEffect(() => {
    const connection = connectToServer({
      onState: setState,
      onMessage: (message) => {
        switch (message.type) {
          case 'hermes_response':
            append({ id: newId(), role: 'hermes', response: message.response });
            setBusy(false);
            break;
          case 'commands':
            append({ id: newId(), role: 'commands', commands: message.commands });
            setBusy(false);
            break;
          case 'terraform':
            append({ id: newId(), role: 'terraform', files: message.files });
            setBusy(false);
            break;
          case 'approval_required':
            append({ id: newId(), role: 'approval', card: message.card, resolved: null });
            break;
          case 'execution_result':
            append({
              id: newId(),
              role: 'result',
              ok: message.ok,
              summary: message.summary,
            });
            setBusy(false);
            break;
          case 'terminal':
            setTerminalLog((prev) => prev + message.chunk);
            break;
          case 'error':
            append({ id: newId(), role: 'error', text: `${message.code}: ${message.message}` });
            setBusy(false);
            break;
        }
      },
    });
    connectionRef.current = connection;
    return () => connection.close();
  }, []);

  const send = () => {
    const text = draft.trim();
    if (text === '' || busy || state !== 'connected') return;
    const sent = connectionRef.current?.send({
      type: 'user_message',
      conversationId,
      workspaceId: workspace.id,
      mode,
      text,
    });
    if (sent !== true) return;
    append({ id: newId(), role: 'user', text });
    setDraft('');
    setBusy(true);
  };

  const executePlan = (steps: PlanStep[], path: ExecutionPath) => {
    const sent = connectionRef.current?.send({
      type: 'execute_plan',
      conversationId,
      workspaceId: workspace.id,
      steps,
      path,
    });
    if (sent === true) setBusy(true);
  };

  const resolveApproval = (approvalId: string, decision: 'approved' | 'denied') => {
    connectionRef.current?.send({ type: 'approval_resolve', approvalId, decision });
    setEntries((prev) =>
      prev.map((entry) =>
        entry.role === 'approval' && entry.card.approvalId === approvalId
          ? { ...entry, resolved: decision }
          : entry,
      ),
    );
  };

  const reviewProject = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { insights } = await api.workspaceInsights(workspace.id);
      append({ id: newId(), role: 'insights', insights });
    } catch (caught) {
      append({
        id: newId(),
        role: 'error',
        text: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <span className="text-sm font-medium tracking-tight">Cloud Hermes</span>
        <span className="text-xs text-neutral-500">
          {workspace.name} · {workspace.projectId} ·{' '}
          {state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected'}
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
                <ResponseView
                  response={entry.response}
                  onExecutePlan={entry.response.kind === 'plan' ? executePlan : undefined}
                />
              </div>
            )}
            {entry.role === 'insights' && (
              <div className="max-w-[90%] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <InsightsView insights={entry.insights} />
              </div>
            )}
            {entry.role === 'commands' && (
              <div className="max-w-[90%] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <CommandsView commands={entry.commands} />
              </div>
            )}
            {entry.role === 'terraform' && (
              <div className="max-w-[90%] rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <TerraformView files={entry.files} />
              </div>
            )}
            {entry.role === 'approval' && (
              <div className="max-w-[90%] text-sm">
                <ApprovalCardView
                  card={entry.card}
                  resolved={entry.resolved}
                  onResolve={(decision) => resolveApproval(entry.card.approvalId, decision)}
                />
              </div>
            )}
            {entry.role === 'result' && (
              <div
                className={`max-w-[90%] rounded-lg border px-3 py-2 text-sm ${
                  entry.ok
                    ? 'border-neutral-200 bg-white text-neutral-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {entry.summary}
              </div>
            )}
            {entry.role === 'error' && (
              <div className="max-w-[90%] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {entry.text}
              </div>
            )}
          </div>
        ))}

        {busy && <div className="text-sm text-neutral-400">Working…</div>}
        <TerminalLog text={terminalLog} />
      </main>

      <footer className="border-t border-neutral-200 px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <div className="flex items-center gap-1 text-xs">
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
            <button
              type="button"
              onClick={() => void reviewProject()}
              disabled={busy}
              className="ml-auto rounded border border-neutral-300 px-2 py-1 text-neutral-600 disabled:opacity-40"
            >
              Review project
            </button>
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
