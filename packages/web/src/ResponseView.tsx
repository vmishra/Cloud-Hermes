import type { ExecutionPath, HermesResponse, PlanStep } from '@cloud-hermes/core';
import { DiagnosisView } from './DiagnosisView';

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
            <ul className="border-t border-border pt-2 text-xs text-text-subtle">
              {response.citations.map((citation, index) => (
                <li key={index}>
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
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">A few questions</p>
          <ul className="list-disc space-y-1 pl-4 text-text-muted">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ul>
        </div>
      );

    case 'plan':
      return (
        <div className="space-y-2.5">
          <p className="font-medium text-text">{response.summary}</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-text-muted">
            {response.steps.map((step, index) => (
              <li key={index}>
                <span className="font-mono text-text">
                  {step.skillId}:{step.capability}
                </span>{' '}
                — {step.rationale}
              </li>
            ))}
          </ol>
          {onExecutePlan !== undefined && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => onExecutePlan(response.steps, 'run')}
                className="rounded-full bg-accent px-3 py-1.5 text-xs text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04]"
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => onExecutePlan(response.steps, 'commands')}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-muted transition-colors duration-150 hover:border-border-strong"
              >
                Copy commands
              </button>
              <button
                type="button"
                onClick={() => onExecutePlan(response.steps, 'terraform')}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-text-muted transition-colors duration-150 hover:border-border-strong"
              >
                Generate Terraform
              </button>
            </div>
          )}
        </div>
      );

    case 'skill_request':
      return (
        <p className="text-xs text-text-subtle">
          Loading skills: {response.skills.join(', ')}
          {response.reason ? ` — ${response.reason}` : ''}
        </p>
      );

    case 'diagnosis':
      return <DiagnosisView diagnosis={response} />;
  }
}
