import type { Insight } from '@cloud-hermes/core';
import { Severity } from './ui/atoms';
import { ServiceIcon } from './ui/ServiceIcon';

/**
 * Renders a project review — the insights from the best-practice checks. Each
 * observation shows the resource and field it is grounded in.
 */
export function InsightsView({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return <p className="text-ink-3">No observations — the project looks clean.</p>;
  }

  return (
    <div className="space-y-2.5">
      <p className="eyebrow">
        Project review — {insights.length} observation{insights.length === 1 ? '' : 's'}
      </p>
      <ul className="space-y-2.5">
        {insights.map((insight, index) => (
          <li key={index} className="hair-t pt-2.5 first:border-t-0 first:pt-0">
            <div className="flex items-center gap-2">
              <Severity kind={insight.severity} />
              <span className="font-medium text-ink">{insight.title}</span>
            </div>
            <p className="mt-0.5 text-ink-2">{insight.detail}</p>
            <p className="mono mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-4">
              <ServiceIcon kind={insight.resourceId} size={12} />
              {insight.resourceId}
              {insight.field ? ` · ${insight.field}` : ''}
            </p>
            {insight.suggestion !== undefined && (
              <p className="mt-0.5 text-[12px] text-ink-3">{insight.suggestion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
