import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from './api/client';
import { Btn } from './ui/atoms';

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
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-3 px-[18px] py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-ink">Conversation history</h2>
        <Btn variant="secondary" size="sm" onClick={onBack}>
          Back to conversation
        </Btn>
      </div>
      {error !== null && <p className="text-[12px] text-danger">{error}</p>}
      {markdown !== null && (
        <pre className="thin-scroll flex-1 overflow-auto whitespace-pre-wrap rounded-[var(--radius-4)] border border-hairline bg-surface p-4 text-[13px] text-ink">
          {markdown}
        </pre>
      )}
    </div>
  );
}
