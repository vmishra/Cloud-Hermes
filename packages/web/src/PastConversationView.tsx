import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from './api/client';

/**
 * A read-only view of a past conversation. The markdown transcript is the
 * source of truth on disk; this shows it as it was written.
 */
export function PastConversationView({
  workspace,
  conversationId,
  onBack,
}: {
  workspace: Workspace;
  conversationId: string;
  onBack: () => void;
}) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMarkdown(null);
    setError(null);
    api
      .loadConversation(workspace.id, conversationId)
      .then((result) => setMarkdown(result.markdown))
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [workspace.id, conversationId]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Conversation history</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors duration-150 hover:border-border-strong"
        >
          Back to conversation
        </button>
      </div>
      {error !== null && <p className="text-xs text-danger">{error}</p>}
      {markdown !== null && (
        <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-[var(--radius-lg)] border border-border bg-elev-1 p-4 text-sm text-text">
          {markdown}
        </pre>
      )}
    </div>
  );
}
