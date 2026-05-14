import { useState } from 'react';
import type { DiagnosisResponse } from '@cloud-hermes/core';

/**
 * Renders a diagnosis — the step-by-step resolution for a pasted error. Each
 * step's command is already filled in with the operator's real environment
 * values by the harness, and is copyable here.
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

export function DiagnosisView({ diagnosis }: { diagnosis: DiagnosisResponse }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">Diagnosis</p>
      <p className="text-text">{diagnosis.summary}</p>
      {diagnosis.rootCause !== undefined && (
        <p className="text-xs text-text-muted">Root cause — {diagnosis.rootCause}</p>
      )}
      <ol className="space-y-2.5">
        {diagnosis.steps.map((step, index) => (
          <li key={index} className="border-t border-border pt-2.5 first:border-t-0 first:pt-0">
            <p className="text-text">
              <span className="text-text-subtle">{index + 1}.</span> {step.instruction}
            </p>
            {step.command !== undefined && (
              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-text">
                  {step.command}
                </code>
                <CopyButton text={step.command} />
              </div>
            )}
            {step.verify !== undefined && (
              <p className="mt-1 text-xs text-text-subtle">Verify — {step.verify}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
