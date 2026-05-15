import { useState } from 'react';
import type { ApprovalCard, ExecutionCommand, TerraformFile } from '@cloud-hermes/core';
import { Btn, CodeLine, Severity } from './ui/atoms';

/**
 * Views for the three execution paths — copyable commands, generated Terraform,
 * and the human-in-the-loop approval card — plus the live terminal log.
 */

export function CommandsView({ commands }: { commands: ExecutionCommand[] }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">Commands to run</p>
      {commands.map((command, index) => (
        <div key={index} className="space-y-1">
          {command.command !== null ? (
            <CodeLine copyable prefix="$">
              {command.command}
            </CodeLine>
          ) : (
            <CodeLine prefix="#">{command.detail}</CodeLine>
          )}
          {!command.ok && <p className="text-[11px] text-danger">{command.detail}</p>}
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
      <p className="eyebrow">Terraform</p>
      {files.map((file, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="mono text-[11px] text-ink-3">{file.name}</span>
            <Btn variant="quiet" size="sm" onClick={() => download(file)}>
              download
            </Btn>
          </div>
          <pre className="thin-scroll overflow-x-auto rounded-[var(--radius-2)] border border-code-border bg-code-bg p-3 font-mono text-[12px] text-ink">
            {file.hcl}
          </pre>
          {file.unresolved.length > 0 && (
            <p className="text-[11px] text-danger">
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
    <div className="space-y-2.5 rounded-[var(--radius-4)] border border-warning bg-warning-soft p-3.5">
      <div className="flex items-center gap-2">
        <Severity kind={card.classification} />
        <span className="eyebrow">Approval required</span>
      </div>
      <CodeLine prefix="$">{card.argv.join(' ')}</CodeLine>
      <div>
        <p className="eyebrow mb-0.5">Blast radius</p>
        <ul className="list-disc pl-4 text-[12px] text-ink-2">
          {card.blastRadius.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
      {card.policyNotes.length > 0 && (
        <p className="text-[11px] text-ink-4">{card.policyNotes.join(' · ')}</p>
      )}
      {resolved === null ? (
        <div className="flex gap-2">
          <Btn variant="primary" size="md" onClick={() => onResolve('approved')}>
            Approve and proceed
          </Btn>
          <Btn variant="secondary" size="md" onClick={() => onResolve('denied')}>
            Send back
          </Btn>
        </div>
      ) : (
        <p className="text-[12px] text-ink-3">
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
      className="thin-scroll max-h-64 overflow-auto rounded-[var(--radius-4)] border border-hairline bg-term-bg p-3 font-mono text-[12px] text-term-ink"
    >
      {text}
    </pre>
  );
}
