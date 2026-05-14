import type { ResourceGraph } from '../schemas/graph';
import { ALL_CHECKS } from './checks';
import type { Insight, InsightSeverity } from './types';

/**
 * Runs every best-practice check against the resource graph and returns the
 * observations in a deterministic order — most serious first. The result is
 * advisory and non-destructive: a review, never a change.
 */

const SEVERITY_RANK: Record<InsightSeverity, number> = {
  warning: 0,
  advisory: 1,
  info: 2,
};

export function runInsights(graph: ResourceGraph): Insight[] {
  const insights = ALL_CHECKS.flatMap((check) => check(graph));
  return insights.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      a.checkId.localeCompare(b.checkId) ||
      a.resourceId.localeCompare(b.resourceId),
  );
}
