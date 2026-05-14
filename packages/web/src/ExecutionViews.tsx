import { useState } from 'react';
import type { ApprovalCard, ExecutionCommand, TerraformFile } from '@cloud-hermes/core';

/**
 * Views for the three execution paths — copyable commands, generated Terraform,
 * and the human-in-the-loop approval card — plus the live terminal log.
 */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded bg-accent px-2 py-1 text-[10px] uppercase tracking-wider text-accent-ink"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function CommandsView({ commands }: { commands: ExecutionCommand[] }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">Commands to run</p>
      {commands.map((command, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-text">
              {command.command ?? `# ${command.detail}`}
            </code>
            {command.command !== null && <CopyButton text={command.command} />}
          </div>
          {!command.ok && <p className="text-xs text-danger">{command.detail}</p>}
        </div>
      ))}
    </div>
  );
}

export function TerraformView({ files }: { files: TerraformFile[] }) {
  const download = (file: TerraformFile) => {
    const blob = new Blob([file.hcl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">Terraform</p>
      {files.map((file, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-text-muted">{file.name}</span>
            <button
              type="button"
              onClick={() => download(file)}
              className="rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted"
            >
              download
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-border bg-surface-raised p-3 font-mono text-xs text-text">
            {file.hcl}
          </pre>
          {file.unresolved.length > 0 && (
            <p className="text-xs text-danger">
              Unverified — unresolved template slots: {file.unresolved.join(', ')}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ApprovalCardView({
  card,
  resolved,
  onResolve,
}: {
  card: ApprovalCard;
  resolved: 'approved' | 'denied' | null;
  onResolve: (decision: 'approved' | 'denied') => void;
}) {
  return (
    <div className="space-y-2.5 rounded-[var(--radius-lg)] border border-border-strong bg-elev-1 p-3.5">
      <div className="border-l-2 border-accent pl-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">
          Approval required · {card.classification.toLowerCase()}
        </p>
      </div>
      <code className="block overflow-x-auto whitespace-nowrap rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs text-text">
        {card.argv.join(' ')}
      </code>
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">Blast radius</p>
        <ul className="list-disc pl-4 text-xs text-text-muted">
          {card.blastRadius.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
      {card.policyNotes.length > 0 && (
        <p className="text-xs text-text-subtle">{card.policyNotes.join(' · ')}</p>
      )}
      {resolved === null ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onResolve('approved')}
            className="rounded-[var(--radius-lg)] bg-accent px-3 py-1.5 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04]"
          >
            Approve and proceed
          </button>
          <button
            type="button"
            onClick={() => onResolve('denied')}
            className="rounded-[var(--radius-lg)] border border-border bg-elev-1 px-3 py-1.5 text-sm text-text-muted transition-colors duration-150 hover:border-border-strong"
          >
            Send back
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-muted">
          {resolved === 'approved' ? 'Approved.' : 'Sent back — not run.'}
        </p>
      )}
    </div>
  );
}

export function TerminalLog({ text }: { text: string }) {
  if (text === '') return null;
  return (
    <pre
      aria-live="polite"
      className="max-h-64 overflow-auto rounded-[var(--radius-lg)] border border-border bg-[oklch(14%_0.010_260)] p-3 font-mono text-xs text-[oklch(92%_0_0)]"
    >
      {text}
    </pre>
  );
}
