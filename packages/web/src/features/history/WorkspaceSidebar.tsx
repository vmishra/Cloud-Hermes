import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api, type ConversationSummary } from '../../api/client';
import { ThemeToggle, type Theme } from '../../ui/theme';

/**
 * The workspace sidebar — the workspace switcher, the conversation history, and
 * the entry points to a new conversation and the memory panel. Conversations
 * are markdown on disk; this lists them and opens them for viewing.
 */
export function WorkspaceSidebar({
  workspace,
  theme,
  onToggleTheme,
  activeConversationId,
  onNewConversation,
  onOpenConversation,
  onOpenMemory,
  onSwitchWorkspace,
  refreshKey,
}: {
  workspace: Workspace;
  theme: Theme;
  onToggleTheme: () => void;
  activeConversationId: string;
  onNewConversation: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenMemory: () => void;
  onSwitchWorkspace: (workspace: Workspace) => void;
  refreshKey: number;
}) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([workspace]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    api
      .listWorkspaces()
      .then((result) => setWorkspaces(result.workspaces))
      .catch(() => setWorkspaces([workspace]));
  }, [workspace]);

  useEffect(() => {
    api
      .listConversations(workspace.id)
      .then((result) => setConversations(result.conversations))
      .catch(() => setConversations([]));
  }, [workspace.id, refreshKey]);

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-5 border-r border-border bg-elev-1 px-3 py-4">
      <div className="flex items-center justify-between px-1">
        <span className="font-display text-base">Cloud Hermes</span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>

      <div className="space-y-1">
        <span className="px-1 text-[10px] uppercase tracking-[0.18em] text-text-subtle">
          Workspace
        </span>
        <select
          value={workspace.id}
          onChange={(event) => {
            const next = workspaces.find((candidate) => candidate.id === event.target.value);
            if (next !== undefined && next.id !== workspace.id) onSwitchWorkspace(next);
          }}
          className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text"
        >
          {workspaces.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <p className="numeric px-1 font-mono text-[11px] text-text-subtle">{workspace.projectId}</p>
      </div>

      <button
        type="button"
        onClick={onNewConversation}
        className="rounded-md bg-accent px-2 py-1.5 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04]"
      >
        New conversation
      </button>

      <div className="flex-1 space-y-0.5 overflow-y-auto">
        <span className="px-1 text-[10px] uppercase tracking-[0.18em] text-text-subtle">
          History
        </span>
        {conversations.length === 0 && (
          <p className="px-1 pt-1 text-xs text-text-subtle">No conversations yet.</p>
        )}
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onOpenConversation(conversation.id)}
            className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs transition-colors duration-150 ${
              conversation.id === activeConversationId
                ? 'bg-elev-2 text-text'
                : 'text-text-muted hover:bg-elev-2'
            }`}
            title={conversation.title}
          >
            {conversation.title}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenMemory}
        className="rounded-md border border-border px-2 py-1.5 text-sm text-text-muted transition-colors duration-150 hover:border-border-strong"
      >
        Memory
      </button>
    </aside>
  );
}
