import { z } from 'zod';

/**
 * The resource graph — Hermes' normalized model of a Google Cloud project.
 *
 * State sync pulls live GCP state through read-only `gcloud` calls and
 * normalizes it into typed nodes and relationship edges. The graph powers
 * dependency-aware planning, blast-radius computation, and grounded answers.
 * The live project is always the source of truth; the graph is a timestamped
 * cache.
 */

export const GraphNodeKind = z.enum([
  'project',
  'network',
  'subnet',
  'instance',
  'firewall-rule',
  'region',
  'zone',
  // A generic node for any resource discovered by the Cloud Asset Inventory MCP
  // slice that the gcloud sync slices do not cover in detail. Its `data` carries
  // the real GCP `assetType`.
  'asset',
]);

export const GraphNode = z.object({
  /** Stable id, unique within the graph (typically the GCP self-link or name). */
  id: z.string(),
  kind: GraphNodeKind,
  name: z.string(),
  /** Normalized resource detail — the fields Hermes and the CLI actually use. */
  data: z.record(z.string(), z.unknown()),
});

export const GraphEdge = z.object({
  from: z.string(),
  to: z.string(),
  /** e.g. 'in-network', 'in-subnet', 'applies-to'. */
  relation: z.string(),
});

/**
 * One sync slice (`compute networks`, `firewall-rules`, …). An unreadable
 * slice is `unavailable` with a reason — it is never silently empty, so the
 * common "API not enabled" case is a first-class, surfaced state.
 */
export const GraphSlice = z.object({
  slice: z.string(),
  status: z.enum(['ok', 'unavailable']),
  reason: z.string().optional(),
});

export const ResourceGraph = z.object({
  projectId: z.string(),
  /** ISO-8601 timestamp of the sync that produced this snapshot. */
  syncedAt: z.string(),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  slices: z.array(GraphSlice),
});

export type GraphNodeKind = z.infer<typeof GraphNodeKind>;
export type GraphNode = z.infer<typeof GraphNode>;
export type GraphEdge = z.infer<typeof GraphEdge>;
export type GraphSlice = z.infer<typeof GraphSlice>;
export type ResourceGraph = z.infer<typeof ResourceGraph>;
