import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from '../../api/client';

/**
 * The memory panel. Per-workspace memory is markdown the operator owns — the
 * file is the source of truth, so editing here and editing the file by hand are
 * the same operation. Memory shapes future conversations; this is where the
 * operator can see and curate exactly what Hermes remembers.
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
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Memory · {workspace.name}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
        >
          Close
        </button>
      </div>
      <p className="text-xs text-neutral-500">
        Preferences and learnings Cloud Hermes carries into future conversations — preferred
        regions, naming conventions, defaults. Edit freely; this is plain markdown.
      </p>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={status === 'loading'}
        rows={16}
        placeholder="- Prefer the europe-west1 region.\n- Name networks <env>-vpc."
        className="flex-1 resize-none rounded-lg border border-neutral-300 bg-white p-3 font-mono text-xs outline-none focus:border-neutral-500"
      />
      {error !== null && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={status === 'loading' || status === 'saving'}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-neutral-50 disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save memory'}
        </button>
      </div>
    </div>
  );
}
