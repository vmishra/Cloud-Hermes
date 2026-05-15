import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import { HermesMark, LoopRail, StatusDot, Tag, Btn, type LoopStage } from './ui/atoms';
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

const RESPONSE_STAGE: Record<HermesResponse['kind'], string> = {
  answer: 'observe',
  clarifying_questions: 'clarify',
  plan: 'plan',
  skill_request: 'plan',
  diagnosis: 'diagnose',
};

function UserMsg({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-[12px_12px_4px_12px] border border-accent-line bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

function HermesMsg({ stage, children }: { stage?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-border bg-surface">
        <HermesMark size={14} />
      </span>
      <div className="min-w-0 flex-1">
        {stage !== undefined && (
          <div className="mb-1 flex items-center gap-1.5">
            <span className="eyebrow">{stage}</span>
            <span className="h-px w-6 bg-hairline" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

const MIC_ICON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <rect x="4.5" y="1.5" width="3" height="6" rx="1.5" fill="currentColor" />
    <path d="M2.5 6 a 3.5 3.5 0 0 0 7 0" stroke="currentColor" strokeWidth="1" fill="none" />
    <line x1="6" y1="9.5" x2="6" y2="11" stroke="currentColor" strokeWidth="1" />
  </svg>
);

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

  const loopStage: LoopStage = mode === 'create' ? 'plan' : 'observe';
  const connectionTone =
    state !== 'connected' ? 'danger' : busy ? 'accent' : 'success';
  const connectionLabel = state !== 'connected' ? 'offline' : busy ? 'working' : 'standby';

  return (
    <div className="flex flex-1 flex-col">
      {/* MainBar */}
      <header className="hair-b flex items-center gap-4 bg-bg px-[18px] py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="mono shrink-0 text-[10px] text-ink-4">conversation</span>
          <span className="text-ink-5">/</span>
          <span className="truncate text-[12px] text-ink">{workspace.name}</span>
          <Tag tone={mode === 'create' ? 'accent' : mode === 'diagnose' ? 'warning' : 'neutral'}>
            {mode}
          </Tag>
        </div>
        <LoopRail stage={loopStage} compact animated={busy} />
        <span className="h-[18px] w-px bg-hairline" />
        <span className="flex items-center gap-1.5">
          <StatusDot tone={connectionTone} pulse={busy} />
          <span className="eyebrow">{connectionLabel}</span>
        </span>
      </header>

      {/* Transcript */}
      <main className="thin-scroll flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[880px] flex-col gap-[18px] px-[18px] py-6">
          {entries.length === 0 && (
            <p className="display my-auto py-16 text-center text-2xl text-ink-4">
              {mode === 'create'
                ? 'What shall we arrange?'
                : mode === 'diagnose'
                  ? 'What went wrong?'
                  : 'What would you like to know?'}
            </p>
          )}

          {entries.map((entry) => {
            if (entry.role === 'user') return <UserMsg key={entry.id}>{entry.text}</UserMsg>;
            if (entry.role === 'hermes')
              return (
                <HermesMsg key={entry.id} stage={RESPONSE_STAGE[entry.response.kind]}>
                  <div className="rounded-[var(--radius-4)] border border-hairline bg-surface px-3.5 py-3 text-[13px] text-ink">
                    <ResponseView
                      response={entry.response}
                      onExecutePlan={entry.response.kind === 'plan' ? executePlan : undefined}
                    />
                  </div>
                </HermesMsg>
              );
            if (entry.role === 'insights')
              return (
                <HermesMsg key={entry.id} stage="review">
                  <div className="rounded-[var(--radius-4)] border border-hairline bg-surface px-3.5 py-3 text-[13px] text-ink">
                    <InsightsView insights={entry.insights} />
                  </div>
                </HermesMsg>
              );
            if (entry.role === 'commands')
              return (
                <HermesMsg key={entry.id} stage="execute · commands">
                  <div className="rounded-[var(--radius-4)] border border-hairline bg-surface px-3.5 py-3 text-[13px] text-ink">
                    <CommandsView commands={entry.commands} />
                  </div>
                </HermesMsg>
              );
            if (entry.role === 'terraform')
              return (
                <HermesMsg key={entry.id} stage="execute · terraform">
                  <div className="rounded-[var(--radius-4)] border border-hairline bg-surface px-3.5 py-3 text-[13px] text-ink">
                    <TerraformView files={entry.files} />
                  </div>
                </HermesMsg>
              );
            if (entry.role === 'approval')
              return (
                <HermesMsg key={entry.id} stage="execute · approval">
                  <ApprovalCardView
                    card={entry.card}
                    resolved={entry.resolved}
                    onResolve={(decision) => resolveApproval(entry.card.approvalId, decision)}
                  />
                </HermesMsg>
              );
            if (entry.role === 'result')
              return (
                <HermesMsg key={entry.id} stage="execute · result">
                  <div
                    className={`rounded-[var(--radius-3)] border px-3 py-2 text-[12px] ${
                      entry.ok
                        ? 'border-hairline bg-elev-1 text-ink-2'
                        : 'border-danger bg-danger-soft text-danger'
                    }`}
                  >
                    {entry.summary}
                  </div>
                </HermesMsg>
              );
            return (
              <HermesMsg key={entry.id} stage="error">
                <div className="rounded-[var(--radius-3)] border border-danger bg-danger-soft px-3 py-2 text-[12px] text-danger">
                  {entry.text}
                </div>
              </HermesMsg>
            );
          })}

          {busy && (
            <HermesMsg>
              <p className="display text-[13px] text-ink-4" aria-live="polite">
                Thinking…
              </p>
            </HermesMsg>
          )}
          <TerminalLog text={terminalLog} />
        </div>
      </main>

      {/* Composer */}
      <footer className="hair-t bg-bg px-[18px] pb-3.5 pt-3">
        <div className="mx-auto w-full max-w-[880px]">
          <div className="mb-2 flex items-center gap-2">
            <div className="inline-flex rounded-[var(--radius-2)] border border-hairline bg-elev-1 p-0.5">
              {(['converse', 'create', 'diagnose'] as const).map((m) => {
                const on = m === mode;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-[var(--radius-1)] px-2.5 py-[3px] text-[11px] font-medium transition-colors duration-150 ${
                      on
                        ? 'bg-surface text-ink shadow-[0_1px_0_0_var(--hairline)]'
                        : 'text-ink-3 hover:text-ink-2'
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <span className="mono text-[10px] text-ink-4">
              {mode === 'converse'
                ? 'read-only · cites resources'
                : mode === 'create'
                  ? 'plans before it acts · human approval required'
                  : 'guided troubleshooting · reads your environment'}
            </span>
            <span className="flex-1" />
            <Btn variant="quiet" size="sm" onClick={() => void reviewProject()} disabled={busy}>
              Review project
            </Btn>
          </div>

          <div className="flex items-end gap-2 rounded-[var(--radius-4)] border border-border bg-surface px-3 py-2.5">
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
              placeholder={
                mode === 'create'
                  ? 'Describe what you want to arrange…'
                  : mode === 'diagnose'
                    ? 'Paste the error or command output…'
                    : 'Ask about this project…'
              }
              className="min-h-9 flex-1 resize-none border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
            />
            {voice.supported && (
              <button
                type="button"
                onClick={voice.toggle}
                aria-label={voice.listening ? 'Stop dictation' : 'Start dictation'}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-2)] border transition-colors duration-150 ${
                  voice.listening
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-border text-ink-3 hover:border-border-strong'
                }`}
              >
                {MIC_ICON}
              </button>
            )}
            <Btn
              variant="primary"
              size="md"
              onClick={send}
              disabled={busy || state !== 'connected' || draft.trim() === ''}
            >
              Send
              <span className="mono ml-0.5 text-[10px] opacity-70">↵</span>
            </Btn>
          </div>
        </div>
      </footer>
    </div>
  );
}
