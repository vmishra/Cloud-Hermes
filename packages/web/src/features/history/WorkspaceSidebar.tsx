import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api, type ConversationSummary } from '../../api/client';

/**
 * The workspace sidebar — the workspace switcher, the conversation history, and
 * the entry points to a new conversation and the memory panel. Conversations
 * are markdown on disk; this lists them and opens them for viewing.
 */
export function WorkspaceSidebar({
  workspace,
  activeConversationId,
  onNewConversation,
  onOpenConversation,
  onOpenMemory,
  onSwitchWorkspace,
  refreshKey,
}: {
  workspace: Workspace;
  activeConversationId: string;
  onNewConversation: () => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenMemory: () => void;
  onSwitchWorkspace: (workspace: Workspace) => void;
  /** Changes whenever the conversation list should be refetched. */
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
    <aside className="flex w-64 shrink-0 flex-col gap-4 border-r border-neutral-200 bg-white px-3 py-4">
      <div className="space-y-1">
        <span className="px-1 text-[10px] uppercase tracking-wide text-neutral-400">Workspace</span>
        <select
          value={workspace.id}
          onChange={(event) => {
            const next = workspaces.find((candidate) => candidate.id === event.target.value);
            if (next !== undefined && next.id !== workspace.id) onSwitchWorkspace(next);
          }}
          className="w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
        >
          {workspaces.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
        <p className="px-1 font-mono text-[11px] text-neutral-400">{workspace.projectId}</p>
      </div>

      <button
        type="button"
        onClick={onNewConversation}
        className="rounded-md bg-neutral-900 px-2 py-1.5 text-sm text-neutral-50"
      >
        New conversation
      </button>

      <div className="flex-1 space-y-1 overflow-y-auto">
        <span className="px-1 text-[10px] uppercase tracking-wide text-neutral-400">History</span>
        {conversations.length === 0 && (
          <p className="px-1 text-xs text-neutral-400">No conversations yet.</p>
        )}
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onOpenConversation(conversation.id)}
            className={`block w-full truncate rounded px-2 py-1.5 text-left text-xs ${
              conversation.id === activeConversationId
                ? 'bg-neutral-100 text-neutral-900'
                : 'text-neutral-600 hover:bg-neutral-50'
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
        className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm text-neutral-600"
      >
        Memory
      </button>
    </aside>
  );
}
