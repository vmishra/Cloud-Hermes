import { useEffect, useRef, useState } from 'react';
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
import { useVoiceInput } from './ui/useVoiceInput';
import { api } from './api/client';

/**
 * The conversation surface for a workspace — a reasoning turn, an on-demand
 * project review, the three plan-execution paths with the human-in-the-loop
 * approval card, and a live terminal log. Voice input feeds the composer.
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

function StatusDot({ state, busy }: { state: ConnectionState; busy: boolean }) {
  const label = state !== 'connected' ? 'offline' : busy ? 'working' : 'standby';
  const color = state !== 'connected' ? 'bg-border-strong' : busy ? 'bg-accent' : 'bg-success';
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color} ${busy ? 'animate-pulse' : ''}`} />
      <span className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">{label}</span>
    </span>
  );
}

export function Conversation({
  workspace,
  conversationId,
  onTurnComplete,
}: {
  workspace: Workspace;
  conversationId: string;
  onTurnComplete: () => void;
}) {
  const [state, setState] = useState<ConnectionState>('connecting');
  const [mode, setMode] = useState<ConversationMode>('converse');
  const [draft, setDraft] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [terminalLog, setTerminalLog] = useState('');
  const [busy, setBusy] = useState(false);

  const connectionRef = useRef<Connection | null>(null);
  const nextId = useRef(0);
  const newId = () => (nextId.current += 1);
  const append = (entry: Entry) => setEntries((prev) => [...prev, entry]);

  const voice = useVoiceInput((transcript) =>
    setDraft((current) => (current === '' ? transcript : `${current} ${transcript}`)),
  );

  useEffect(() => {
    const connection = connectToServer({
      onState: setState,
      onMessage: (message) => {
        switch (message.type) {
          case 'hermes_response':
            append({ id: newId(), role: 'hermes', response: message.response });
            setBusy(false);
            onTurnComplete();
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
            append({ id: newId(), role: 'result', ok: message.ok, summary: message.summary });
            setBusy(false);
            break;
          case 'terminal':
            setTerminalLog((prev) => prev + message.chunk);
            break;
          case 'error':
            append({ id: newId(), role: 'error', text: `${message.code}: ${message.message}` });
            setBusy(false);
            onTurnComplete();
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
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-medium tracking-tight text-text">{workspace.name}</span>
        <StatusDot state={state} busy={busy} />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-6 py-10">
        {entries.length === 0 && (
          <p className="my-auto text-center font-display text-xl italic text-text-subtle">
            What would you like to arrange?
          </p>
        )}

        {entries.map((entry) => (
          <div key={entry.id}>
            {entry.role === 'user' && (
              <div className="ml-auto max-w-[80%] rounded-[var(--radius-lg)] bg-accent-soft px-3.5 py-2 text-sm text-text">
                {entry.text}
              </div>
            )}
            {entry.role === 'hermes' && (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] border border-border bg-elev-1 px-3.5 py-2.5 text-sm text-text">
                <ResponseView
                  response={entry.response}
                  onExecutePlan={entry.response.kind === 'plan' ? executePlan : undefined}
                />
              </div>
            )}
            {entry.role === 'insights' && (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] border border-border bg-elev-1 px-3.5 py-2.5 text-sm text-text">
                <InsightsView insights={entry.insights} />
              </div>
            )}
            {entry.role === 'commands' && (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] border border-border bg-elev-1 px-3.5 py-2.5 text-sm text-text">
                <CommandsView commands={entry.commands} />
              </div>
            )}
            {entry.role === 'terraform' && (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] border border-border bg-elev-1 px-3.5 py-2.5 text-sm text-text">
                <TerraformView files={entry.files} />
              </div>
            )}
            {entry.role === 'approval' && (
              <div className="max-w-[92%] text-sm">
                <ApprovalCardView
                  card={entry.card}
                  resolved={entry.resolved}
                  onResolve={(decision) => resolveApproval(entry.card.approvalId, decision)}
                />
              </div>
            )}
            {entry.role === 'result' && (
              <div
                className={`max-w-[92%] rounded-[var(--radius-lg)] border px-3.5 py-2 text-sm ${
                  entry.ok
                    ? 'border-border bg-elev-1 text-text-muted'
                    : 'border-danger bg-danger-soft text-danger'
                }`}
              >
                {entry.summary}
              </div>
            )}
            {entry.role === 'error' && (
              <div className="max-w-[92%] rounded-[var(--radius-lg)] border border-danger bg-danger-soft px-3.5 py-2 text-sm text-danger">
                {entry.text}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <p className="font-display text-sm italic text-text-subtle" aria-live="polite">
            Thinking…
          </p>
        )}
        <TerminalLog text={terminalLog} />
      </main>

      <footer className="border-t border-border px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          <div className="flex items-center gap-1 text-[11px]">
            {(['converse', 'create'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-2.5 py-1 transition-[filter] duration-150 ${
                  mode === m
                    ? 'bg-accent-soft text-text'
                    : 'bg-elev-2 text-text-muted hover:brightness-[1.05]'
                }`}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void reviewProject()}
              disabled={busy}
              className="ml-auto rounded-full border border-border px-2.5 py-1 text-text-muted transition-colors duration-150 hover:border-border-strong disabled:opacity-40"
            >
              Review project
            </button>
          </div>
          <div className="flex items-end gap-2">
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
              aria-label="Message Cloud Hermes"
              className="flex-1 resize-none rounded-[var(--radius-lg)] border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-text outline-none transition-colors duration-150 placeholder:text-text-subtle focus:border-border-strong"
            />
            {voice.supported && (
              <button
                type="button"
                onClick={voice.toggle}
                aria-label={voice.listening ? 'Stop dictation' : 'Start dictation'}
                className={`h-10 w-10 shrink-0 rounded-full border text-[11px] uppercase tracking-wider transition-colors duration-150 ${
                  voice.listening
                    ? 'border-accent bg-accent-soft text-text'
                    : 'border-border text-text-muted hover:border-border-strong'
                }`}
              >
                {voice.listening ? '•••' : 'mic'}
              </button>
            )}
            <button
              type="button"
              onClick={send}
              disabled={busy || state !== 'connected' || draft.trim() === ''}
              className="h-10 shrink-0 rounded-[var(--radius-lg)] bg-accent px-4 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04] disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
