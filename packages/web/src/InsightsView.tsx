import type { Insight } from '@cloud-hermes/core';

/**
 * Renders a project review — the insights from the best-practice checks. Each
 * observation shows the resource and field it is grounded in.
 */
export function InsightsView({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="text-text-muted">No observations — the project looks clean.</p>;
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-text-subtle">
        Project review — {insights.length} observation{insights.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2.5">
        {insights.map((insight, index) => (
          <li key={index} className="border-t border-border pt-2.5 first:border-t-0 first:pt-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-[10px] uppercase tracking-[0.18em] ${
                  insight.severity === 'warning' ? 'text-danger' : 'text-text-subtle'
                }`}
              >
                {insight.severity}
              </span>
              <span className="font-medium text-text">{insight.title}</span>
            </div>
            <p className="text-text-muted">{insight.detail}</p>
            <p className="numeric font-mono text-xs text-text-subtle">
              {insight.resourceId}
              {insight.field ? ` · ${insight.field}` : ''}
            </p>
            {insight.suggestion !== undefined && (
              <p className="text-xs text-text-muted">{insight.suggestion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
