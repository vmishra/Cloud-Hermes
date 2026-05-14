import type { ExecutionPath, HermesResponse, PlanStep } from '@cloud-hermes/core';

/**
 * Renders a HermesResponse by kind. A single dispatcher over the discriminated
 * union — the typed protocol drives the UI. A plan additionally offers the
 * three execution paths. A minimal pass; the designed plan and approval cards
 * come with the design system.
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
          <p className="whitespace-pre-wrap">{response.markdown}</p>
          {response.citations.length > 0 && (
            <ul className="border-t border-neutral-100 pt-2 text-xs text-neutral-500">
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
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-neutral-400">A few questions</p>
          <ul className="list-disc space-y-1 pl-4">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ul>
        </div>
      );

    case 'plan':
      return (
        <div className="space-y-2">
          <p className="font-medium">{response.summary}</p>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-neutral-600">
            {response.steps.map((step, index) => (
              <li key={index}>
                <span className="font-mono">
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
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-neutral-50"
              >
                Run
              </button>
              <button
                type="button"
                onClick={() => onExecutePlan(response.steps, 'commands')}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              >
                Copy commands
              </button>
              <button
                type="button"
                onClick={() => onExecutePlan(response.steps, 'terraform')}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              >
                Generate Terraform
              </button>
            </div>
          )}
        </div>
      );

    case 'skill_request':
      return (
        <p className="text-xs text-neutral-500">
          Loading skills: {response.skills.join(', ')}
          {response.reason ? ` — ${response.reason}` : ''}
        </p>
      );
  }
}
