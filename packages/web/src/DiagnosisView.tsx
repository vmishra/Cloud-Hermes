import type { DiagnosisResponse } from '@cloud-hermes/core';
import { CodeLine } from './ui/atoms';

/**
 * Renders a diagnosis — the step-by-step resolution for a pasted error. Each
 * step's command is already filled in with the operator's real environment
 * values by the harness, and is copyable here.
 */
export function DiagnosisView({ diagnosis }: { diagnosis: DiagnosisResponse }) {
  return (
    <div className="space-y-2.5">
      <p className="text-ink">{diagnosis.summary}</p>
      {diagnosis.rootCause !== undefined && (
        <p className="text-[12px] text-ink-3">
          <span className="eyebrow mr-1.5">Root cause</span>
          {diagnosis.rootCause}
        </p>
      )}
      <ol className="space-y-2.5">
        {diagnosis.steps.map((step, index) => (
          <li key={index} className="hair-t pt-2.5 first:border-t-0 first:pt-0">
            <p className="text-[13px] text-ink">
              <span className="mono mr-1.5 text-ink-5">{index + 1}</span>
              {step.instruction}
            </p>
            {step.command !== undefined && (
              <div className="mt-1.5">
                <CodeLine copyable prefix="$">
                  {step.command}
                </CodeLine>
              </div>
            )}
            {step.verify !== undefined && (
              <p className="mt-1 text-[11px] text-ink-4">
                <span className="eyebrow mr-1.5">Verify</span>
                {step.verify}
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
