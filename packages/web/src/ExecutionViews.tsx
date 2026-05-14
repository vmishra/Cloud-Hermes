import { useState } from 'react';
import type { ApprovalCard, ExecutionCommand, TerraformFile } from '@cloud-hermes/core';

/**
 * Views for the three execution paths — copyable commands, generated Terraform,
 * and the human-in-the-loop approval card — plus the live terminal log. A
 * minimal pass; the designed treatment comes with the design system.
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
      className="shrink-0 rounded bg-neutral-900 px-2 py-1 text-[11px] text-neutral-50"
    >
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function CommandsView({ commands }: { commands: ExecutionCommand[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-neutral-400">Commands to run</p>
      {commands.map((command, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 font-mono text-xs">
            <code className="flex-1 overflow-x-auto whitespace-nowrap">
              {command.command ?? `# ${command.detail}`}
            </code>
            {command.command !== null && <CopyButton text={command.command} />}
          </div>
          {!command.ok && <p className="text-xs text-red-600">{command.detail}</p>}
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
      <p className="text-xs uppercase tracking-wide text-neutral-400">Terraform</p>
      {files.map((file, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-neutral-500">{file.name}</span>
            <button
              type="button"
              onClick={() => download(file)}
              className="rounded border border-neutral-300 px-2 py-0.5 text-[11px]"
            >
              download
            </button>
          </div>
          <pre className="overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs">
            {file.hcl}
          </pre>
          {file.unresolved.length > 0 && (
            <p className="text-xs text-amber-600">
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
    <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs uppercase tracking-wide text-amber-700">
        Approval required · {card.classification.toLowerCase()}
      </p>
      <code className="block overflow-x-auto whitespace-nowrap rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs">
        {card.argv.join(' ')}
      </code>
      <div>
        <p className="text-xs text-neutral-500">Blast radius</p>
        <ul className="list-disc pl-4 text-xs text-neutral-700">
          {card.blastRadius.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
      {card.policyNotes.length > 0 && (
        <p className="text-xs text-neutral-500">{card.policyNotes.join(' · ')}</p>
      )}
      {resolved === null ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onResolve('approved')}
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-neutral-50"
          >
            Approve and proceed
          </button>
          <button
            type="button"
            onClick={() => onResolve('denied')}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm"
          >
            Send back
          </button>
        </div>
      ) : (
        <p className="text-xs text-neutral-600">
          {resolved === 'approved' ? 'Approved.' : 'Sent back — not run.'}
        </p>
      )}
    </div>
  );
}

export function TerminalLog({ text }: { text: string }) {
  if (text === '') return null;
  return (
    <pre className="max-h-64 overflow-auto rounded-lg border border-neutral-700 bg-neutral-900 p-3 font-mono text-xs text-neutral-100">
      {text}
    </pre>
  );
}
