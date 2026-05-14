import { useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { WorkspaceSidebar } from './features/history/WorkspaceSidebar';
import { MemoryPanel } from './features/memory/MemoryPanel';
import { Conversation } from './Conversation';
import { PastConversationView } from './PastConversationView';

/**
 * The workspace shell — the sidebar plus the main pane. The main pane is the
 * live conversation, a read-only past conversation, or the memory panel. The
 * dual-pane workspace layout with the terminal drawer comes with the design
 * pass; this is the structure it is built on.
 */

type View =
  | { kind: 'conversation' }
  | { kind: 'past'; conversationId: string }
  | { kind: 'memory' };

export function WorkspaceShell({
  workspace,
  onSwitchWorkspace,
}: {
  workspace: Workspace;
  onSwitchWorkspace: (workspace: Workspace) => void;
}) {
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [view, setView] = useState<View>({ kind: 'conversation' });
  const [refreshKey, setRefreshKey] = useState(0);

  const startNewConversation = () => {
    setConversationId(crypto.randomUUID());
    setView({ kind: 'conversation' });
  };

  return (
    <div className="flex min-h-dvh bg-neutral-50 text-neutral-900">
      <WorkspaceSidebar
        workspace={workspace}
        activeConversationId={view.kind === 'past' ? view.conversationId : conversationId}
        onNewConversation={startNewConversation}
        onOpenConversation={(id) => setView({ kind: 'past', conversationId: id })}
        onOpenMemory={() => setView({ kind: 'memory' })}
        onSwitchWorkspace={onSwitchWorkspace}
        refreshKey={refreshKey}
      />
      <div className="flex flex-1 flex-col">
        {view.kind === 'conversation' && (
          <Conversation
            key={conversationId}
            workspace={workspace}
            conversationId={conversationId}
            onTurnComplete={() => setRefreshKey((key) => key + 1)}
          />
        )}
        {view.kind === 'past' && (
          <PastConversationView
            workspace={workspace}
            conversationId={view.conversationId}
            onBack={() => setView({ kind: 'conversation' })}
          />
        )}
        {view.kind === 'memory' && (
          <MemoryPanel workspace={workspace} onClose={() => setView({ kind: 'conversation' })} />
        )}
      </div>
    </div>
  );
}
