import type { ResourceGraph } from '../schemas/graph';

/**
 * Insights — proactive, advisory, non-destructive review of a project.
 *
 * An insight is an observation, never an action. Every one cites the specific
 * resource and field it rests on, so the operator can see exactly why it was
 * raised — evidence-linked, like every other claim Cloud Hermes makes.
 */

export type InsightSeverity = 'info' | 'advisory' | 'warning';

export interface Insight {
  /** The check that produced this observation. */
  checkId: string;
  severity: InsightSeverity;
  /** A short, specific headline. */
  title: string;
  /** The observation in full. */
  detail: string;
  /** The resource-graph node id this observation is about — the evidence. */
  resourceId: string;
  /** The specific field the observation rests on, when there is one. */
  field?: string;
  /** A suggested next step — often a create or update the operator could ask for. */
  suggestion?: string;
}

/** A single best-practice check: it reads the graph and returns observations. */
export type InsightCheck = (graph: ResourceGraph) => Insight[];
