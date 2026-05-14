import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from '../../api/client';

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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-10">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text">Memory · {workspace.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-text-muted transition-colors duration-150 hover:border-border-strong"
        >
          Close
        </button>
      </div>
      <p className="text-xs text-text-muted">
        Preferences and learnings Cloud Hermes carries into future conversations — preferred
        regions, naming conventions, defaults. Edit freely; this is plain markdown.
      </p>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={status === 'loading'}
        rows={16}
        placeholder="- Prefer the europe-west1 region.&#10;- Name networks <env>-vpc."
        className="flex-1 resize-none rounded-[var(--radius-lg)] border border-border bg-surface-raised p-3.5 font-mono text-xs text-text outline-none transition-colors duration-150 placeholder:text-text-subtle focus:border-border-strong"
      />
      {error !== null && <p className="text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === 'loading' || status === 'saving'}
          className="rounded-[var(--radius-lg)] bg-accent px-3.5 py-1.5 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04] disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save memory'}
        </button>
      </div>
    </div>
  );
}
