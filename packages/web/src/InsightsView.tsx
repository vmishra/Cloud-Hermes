import type { Insight } from '@cloud-hermes/core';

/**
 * Renders a project review — the insights from the best-practice checks. Each
 * observation shows the resource and field it is grounded in. A minimal pass;
 * the designed treatment comes with the design system.
 */
export function InsightsView({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="text-neutral-500">No observations — the project looks clean.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-neutral-400">
        Project review — {insights.length} observation{insights.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2">
        {insights.map((insight, index) => (
          <li key={index} className="border-t border-neutral-100 pt-2 first:border-t-0 first:pt-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[10px] uppercase tracking-wide ${
                  insight.severity === 'warning' ? 'text-red-600' : 'text-neutral-400'
                }`}
              >
                {insight.severity}
              </span>
              <span className="font-medium">{insight.title}</span>
            </div>
            <p className="text-neutral-600">{insight.detail}</p>
            <p className="text-xs text-neutral-400">
              {insight.resourceId}
              {insight.field ? ` · ${insight.field}` : ''}
            </p>
            {insight.suggestion !== undefined && (
              <p className="text-xs text-neutral-500">{insight.suggestion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
