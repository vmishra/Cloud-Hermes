import type { ExecutionPath, HermesResponse, PlanStep } from '@cloud-hermes/core';
import { DiagnosisView } from './DiagnosisView';
import { Btn, Severity } from './ui/atoms';
import { ServiceIcon } from './ui/ServiceIcon';

/**
 * Renders a HermesResponse by kind — a single dispatcher over the discriminated
 * union, so the typed protocol drives the UI. A plan additionally offers the
 * three execution paths.
 */
export function ResponseView({
  response,
  onExecutePlan,
}: {
  response: HermesResponse;
  onExecutePlan?: (steps: PlanStep[], path: ExecutionPath) => void;
}) {
  switch (response.kind) {
    case 'answer':
      return (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap leading-relaxed">{response.markdown}</p>
          {response.citations.length > 0 && (
            <ul className="hair-t mt-2 space-y-0.5 pt-2 text-[11px] text-ink-4">
              {response.citations.map((citation, index) => (
                <li key={index} className="mono">
                  {citation.label}
                  {citation.resourceId ? ` · ${citation.resourceId}` : ''}
                  {citation.field ? ` · ${citation.field}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'clarifying_questions':
      return (
        <div className="space-y-1.5">
          <p className="eyebrow">A few questions</p>
          <ul className="list-disc space-y-1 pl-4 text-ink-2">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ul>
        </div>
      );

    case 'plan':
      return (
        <div className="space-y-2.5">
          <p className="font-medium text-ink">{response.summary}</p>
          <ol className="space-y-1.5">
            {response.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mono mt-0.5 text-[11px] text-ink-5">{index + 1}</span>
                <ServiceIcon kind={step.skillId} size={14} className="mt-px shrink-0" />
                <span className="min-w-0 flex-1 text-[12px] text-ink-2">
                  <span className="mono text-ink">
                    {step.skillId}:{step.capability}
                  </span>{' '}
                  — {step.rationale}
                </span>
              </li>
            ))}
          </ol>
          {onExecutePlan !== undefined && (
            <div className="flex flex-wrap gap-2 pt-0.5">
              <Btn variant="primary" size="sm" onClick={() => onExecutePlan(response.steps, 'run')}>
                Run
              </Btn>
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => onExecutePlan(response.steps, 'commands')}
              >
                Copy commands
              </Btn>
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => onExecutePlan(response.steps, 'terraform')}
              >
                Generate Terraform
              </Btn>
            </div>
          )}
        </div>
      );

    case 'skill_request':
      return (
        <p className="flex items-center gap-1.5 text-[12px] text-ink-4">
          <Severity kind="info" />
          Loading skills: {response.skills.join(', ')}
          {response.reason ? ` — ${response.reason}` : ''}
        </p>
      );

    case 'diagnosis':
      return <DiagnosisView diagnosis={response} />;
  }
}
