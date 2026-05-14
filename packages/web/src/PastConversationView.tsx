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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Conversation history</h2>
        <button
          type="button"
          onClick={onBack}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
        >
          Back to conversation
        </button>
      </div>
      {error !== null && <p className="text-xs text-red-600">{error}</p>}
      {markdown !== null && (
        <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white p-4 text-sm">
          {markdown}
        </pre>
      )}
    </div>
  );
}
