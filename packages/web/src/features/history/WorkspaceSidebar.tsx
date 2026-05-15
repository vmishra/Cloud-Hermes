import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api, type ConversationSummary } from '../../api/client';
import { ThemeToggle, type Theme } from '../../ui/theme';
import { Wordmark, Btn, StatusDot } from '../../ui/atoms';
import { ServiceIcon } from '../../ui/ServiceIcon';

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
    <aside className="hair-r flex w-[244px] shrink-0 flex-col bg-surface">
      {/* Brand */}
      <div className="hair-b px-3.5 py-3">
        <Wordmark size={15} />
      </div>

      {/* Workspace switcher */}
      <div className="hair-b px-3 pb-2 pt-2.5">
        <div className="eyebrow mb-1.5 pl-0.5">Workspace</div>
        <div className="flex items-center gap-2 rounded-[var(--radius-2)] border border-hairline bg-elev-1 px-2 py-1.5">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            <ServiceIcon kind="networking" size={14} />
          </span>
          <select
            value={workspace.id}
            onChange={(event) => {
              const next = workspaces.find((candidate) => candidate.id === event.target.value);
              if (next !== undefined && next.id !== workspace.id) onSwitchWorkspace(next);
            }}
            className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-[12px] text-ink outline-none"
          >
            {workspaces.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mono mt-1 pl-0.5 text-[10px] text-ink-4">gcp · {workspace.projectId}</p>
      </div>

      {/* New conversation */}
      <div className="hair-b px-3 py-2.5">
        <Btn variant="primary" size="md" onClick={onNewConversation} className="w-full">
          <span className="mr-0.5 text-[14px] leading-none">+</span>New conversation
        </Btn>
      </div>

      {/* History */}
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-2.5">
        <div className="eyebrow mb-1.5 pl-1.5">History</div>
        <div className="thin-scroll flex flex-1 flex-col gap-px overflow-auto">
          {conversations.length === 0 && (
            <p className="px-1.5 pt-1 text-[12px] text-ink-4">No conversations yet.</p>
          )}
          {conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onOpenConversation(conversation.id)}
                title={conversation.title}
                className={`flex items-baseline gap-1.5 rounded-[var(--radius-1)] px-2 py-1.5 text-left transition-colors duration-150 ${
                  active ? 'bg-elev-2' : 'hover:bg-elev-1'
                }`}
              >
                <span
                  className={`flex-1 truncate text-[12px] ${active ? 'text-ink' : 'text-ink-3'}`}
                >
                  {conversation.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="hair-t flex items-center gap-2 px-3 py-2">
        <Btn variant="ghost" size="sm" onClick={onOpenMemory}>
          Memory
        </Btn>
        <span className="flex-1" />
        <StatusDot tone="success" pulse />
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </aside>
  );
}
