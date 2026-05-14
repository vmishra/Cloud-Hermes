import {
  classifyGcloudCommand,
  type CapabilityTable,
  type GraphEdge,
  type GraphNode,
  type GraphSlice,
  type ResourceGraph,
} from '@cloud-hermes/core';
import { executeClassified, type GcloudExecOptions } from './executor';
import {
  EMPTY_FRAGMENT,
  normalizeFirewalls,
  normalizeInstances,
  normalizeNetworks,
  normalizeProject,
  normalizeRegions,
  normalizeSubnets,
  normalizeZones,
  type GraphFragment,
} from './normalize';
import { MCP_ENABLED } from '../config';
import { fetchAssetInventory } from '../mcp/index';

/**
 * Read-only state sync.
 *
 * Pulls the live state of a Google Cloud project through read-only gcloud
 * calls and normalizes it into the resource graph. The live project is the
 * source of truth; the graph is a timestamped cache.
 *
 * Sync uses the same guard as everything else — no bypass — so its reads are
 * declared in a capability table and classified READ like any other command.
 * Slices run in parallel and fail independently: one slice that cannot be read
 * (a disabled API, a permission gap) is marked `unavailable` with its reason,
 * never silently empty, and never derails the rest of the sync.
 */

/** The capability table state sync classifies its own read commands against. */
export const STATE_SYNC_CAPABILITIES: CapabilityTable = {
  skillId: 'gcp-state-sync',
  capabilities: [
    { service: 'compute', resourceType: 'networks', verb: 'list', classification: 'READ' },
    { service: 'compute', resourceType: 'networks subnets', verb: 'list', classification: 'READ' },
    { service: 'compute', resourceType: 'instances', verb: 'list', classification: 'READ' },
    { service: 'compute', resourceType: 'firewall-rules', verb: 'list', classification: 'READ' },
    { service: 'compute', resourceType: 'regions', verb: 'list', classification: 'READ' },
    { service: 'compute', resourceType: 'zones', verb: 'list', classification: 'READ' },
    { service: 'projects', resourceType: '', verb: 'describe', classification: 'READ' },
  ],
};

interface SyncSlice {
  slice: string;
  argv: (projectId: string) => string[];
  normalize: (raw: unknown) => GraphFragment;
}

const SYNC_SLICES: SyncSlice[] = [
  {
    slice: 'compute-networks',
    argv: () => ['gcloud', 'compute', 'networks', 'list', '--format=json'],
    normalize: normalizeNetworks,
  },
  {
    slice: 'compute-subnets',
    argv: () => ['gcloud', 'compute', 'networks', 'subnets', 'list', '--format=json'],
    normalize: normalizeSubnets,
  },
  {
    slice: 'compute-instances',
    argv: () => ['gcloud', 'compute', 'instances', 'list', '--format=json'],
    normalize: normalizeInstances,
  },
  {
    slice: 'compute-firewall-rules',
    argv: () => ['gcloud', 'compute', 'firewall-rules', 'list', '--format=json'],
    normalize: normalizeFirewalls,
  },
  {
    slice: 'compute-regions',
    argv: () => ['gcloud', 'compute', 'regions', 'list', '--format=json'],
    normalize: normalizeRegions,
  },
  {
    slice: 'compute-zones',
    argv: () => ['gcloud', 'compute', 'zones', 'list', '--format=json'],
    normalize: normalizeZones,
  },
  {
    slice: 'project',
    argv: (projectId) => ['gcloud', 'projects', 'describe', projectId, '--format=json'],
    normalize: normalizeProject,
  },
];

export interface SyncOptions {
  cwd?: string;
  signal?: AbortSignal;
  /** Receives redacted output for the live terminal view. */
  onTerminal?: GcloudExecOptions['onTerminal'];
}

export interface SyncResult {
  graph: ResourceGraph;
  /** Raw gcloud JSON per slice, kept alongside the graph for debugging. */
  raw: Record<string, unknown>;
}

const firstLine = (text: string): string => text.split('\n')[0]?.trim() ?? '';

interface SliceOutcome {
  slice: string;
  status: GraphSlice['status'];
  reason?: string;
  fragment: GraphFragment;
  raw: unknown;
}

async function runSlice(slice: SyncSlice, projectId: string, options: SyncOptions): Promise<SliceOutcome> {
  const argv = slice.argv(projectId);
  const classified = classifyGcloudCommand(argv, [STATE_SYNC_CAPABILITIES]);

  // Sync must only ever run reads. A non-READ verdict here is a bug, not a
  // runtime condition — surface it as an unavailable slice rather than run it.
  if (classified.classification !== 'READ') {
    return {
      slice: slice.slice,
      status: 'unavailable',
      reason: `sync command classified ${classified.classification}, expected READ`,
      fragment: EMPTY_FRAGMENT,
      raw: null,
    };
  }

  try {
    const result = await executeClassified(classified, {
      source: 'gcloud',
      cwd: options.cwd,
      signal: options.signal,
      onTerminal: options.onTerminal,
    });
    if (!result.ok) {
      return {
        slice: slice.slice,
        status: 'unavailable',
        reason: firstLine(result.stderrTail) || `gcloud exited with code ${result.exitCode ?? 'unknown'}`,
        fragment: EMPTY_FRAGMENT,
        raw: null,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.stdout);
    } catch {
      return {
        slice: slice.slice,
        status: 'unavailable',
        reason: 'gcloud output was not valid JSON',
        fragment: EMPTY_FRAGMENT,
        raw: null,
      };
    }
    return {
      slice: slice.slice,
      status: 'ok',
      fragment: slice.normalize(parsed),
      raw: parsed,
    };
  } catch (err) {
    return {
      slice: slice.slice,
      status: 'unavailable',
      reason: err instanceof Error ? err.message : String(err),
      fragment: EMPTY_FRAGMENT,
      raw: null,
    };
  }
}

/** Pulls live project state and assembles the resource graph. */
export async function syncState(projectId: string, options: SyncOptions = {}): Promise<SyncResult> {
  const outcomes = await Promise.all(
    SYNC_SLICES.map((slice) => runSlice(slice, projectId, options)),
  );

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const slices: GraphSlice[] = [];
  const raw: Record<string, unknown> = {};

  for (const outcome of outcomes) {
    slices.push({
      slice: outcome.slice,
      status: outcome.status,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    });
    if (outcome.status === 'ok') {
      nodes.push(...outcome.fragment.nodes);
      edges.push(...outcome.fragment.edges);
      raw[outcome.slice] = outcome.raw;
    }
  }

  // Opt-in: a project-wide inventory from the Cloud Asset Inventory MCP server.
  // Read-only and Observe-stage only — it adds breadth to the graph and never
  // touches the guard. When disabled or unreachable, the graph is exactly what
  // the gcloud slices produced; an MCP failure is just an unavailable slice.
  if (MCP_ENABLED) {
    const inventory = await fetchAssetInventory(projectId);
    slices.push({
      slice: 'asset-inventory',
      status: inventory.status,
      ...(inventory.reason ? { reason: inventory.reason } : {}),
    });
    if (inventory.status === 'ok') {
      nodes.push(...inventory.fragment.nodes);
      edges.push(...inventory.fragment.edges);
    }
  }

  const graph: ResourceGraph = {
    projectId,
    syncedAt: new Date().toISOString(),
    nodes,
    edges,
    slices,
  };
  return { graph, raw };
}
