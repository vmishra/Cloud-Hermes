import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from '../../api/client';
import { Btn } from '../../ui/atoms';

/**
 * The memory panel. Per-workspace memory is markdown the operator owns — the
 * file is the source of truth, so editing here and editing the file by hand are
 * the same operation. Memory shapes future conversations; this is where the
 * operator can see and curate exactly what Hermes carries forward.
 */
export function MemoryPanel({ workspace, onClose }: { workspace: Workspace; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMemory(workspace.id)
      .then((result) => {
        setContent(result.content);
        setStatus('ready');
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, [workspace.id]);

  const save = async () => {
    setStatus('saving');
    setError(null);
    try {
      await api.putMemory(workspace.id, content);
      setStatus('saved');
      setTimeout(() => setStatus('ready'), 1500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStatus('ready');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col gap-3 px-[18px] py-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-ink">Memory · {workspace.name}</h2>
        <Btn variant="secondary" size="sm" onClick={onClose}>
          Close
        </Btn>
      </div>
      <p className="text-[12px] text-ink-3">
        Preferences and learnings Cloud Hermes carries into future conversations — preferred
        regions, naming conventions, defaults. Edit freely; this is plain markdown.
      </p>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={status === 'loading'}
        rows={16}
        placeholder="- Prefer the europe-west1 region.&#10;- Name networks <env>-vpc."
        className="thin-scroll flex-1 resize-none rounded-[var(--radius-4)] border border-border bg-surface p-3.5 font-mono text-[12px] text-ink outline-none focus:border-border-strong"
      />
      {error !== null && <p className="text-[12px] text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <Btn
          variant="primary"
          size="md"
          onClick={() => void save()}
          disabled={status === 'loading' || status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save memory'}
        </Btn>
      </div>
    </div>
  );
}
