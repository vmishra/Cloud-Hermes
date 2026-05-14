import type { GraphEdge, GraphNode, GraphNodeKind, ResourceGraph } from '../schemas/graph';

/**
 * Queries over the resource graph.
 *
 * The graph is Hermes' normalized model of a Google Cloud project. An edge's
 * `from` depends on its `to` — a subnet is `in-network` its VPC, an instance is
 * `in-subnet` its subnet — so changing a `to` node affects every `from`. That
 * convention is what makes blast radius computable.
 */

export function findNode(graph: ResourceGraph, id: string): GraphNode | undefined {
  return graph.nodes.find((node) => node.id === id);
}

/** Direct dependents: the nodes with an edge pointing to `nodeId`. */
export function directDependents(graph: ResourceGraph, nodeId: string): GraphNode[] {
  const dependentIds = new Set(
    graph.edges.filter((edge) => edge.to === nodeId).map((edge) => edge.from),
  );
  return graph.nodes.filter((node) => dependentIds.has(node.id));
}

/**
 * The blast radius of a node: the node itself plus every node that transitively
 * depends on it. This is what an update to the node would touch — the basis for
 * the approval card's impact summary.
 */
export function blastRadius(graph: ResourceGraph, nodeId: string): GraphNode[] {
  if (findNode(graph, nodeId) === undefined) return [];

  const visited = new Set<string>([nodeId]);
  const queue: string[] = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.to === current && !visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return graph.nodes.filter((node) => visited.has(node.id));
}

/** Kinds that appear, in this order, in the prompt summary. Regions and zones
 *  are reference catalogs, not project state, so they are summarized as counts. */
const SUMMARY_KINDS: GraphNodeKind[] = ['network', 'subnet', 'instance', 'firewall-rule'];

const KIND_LABELS: Record<GraphNodeKind, string> = {
  project: 'Project',
  network: 'Networks',
  subnet: 'Subnets',
  instance: 'Instances',
  'firewall-rule': 'Firewall rules',
  region: 'Regions',
  zone: 'Zones',
};

function renderData(data: Record<string, unknown>): string {
  const entries = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && typeof value !== 'object')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`);
  return entries.length > 0 ? ` (${entries.join(', ')})` : '';
}

/**
 * A compact, deterministically-ordered text summary of the graph for the
 * prompt. Everything is sorted — keys, nodes, edges — so the summary does not
 * reshuffle between turns and defeat prompt caching.
 */
export function summarizeGraph(graph: ResourceGraph): string {
  const lines: string[] = [`Project: ${graph.projectId} (synced ${graph.syncedAt})`];

  const nameById = new Map(graph.nodes.map((node) => [node.id, node.name]));
  const edgesByFrom = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = edgesByFrom.get(edge.from) ?? [];
    list.push(edge);
    edgesByFrom.set(edge.from, list);
  }

  for (const kind of SUMMARY_KINDS) {
    const nodes = graph.nodes
      .filter((node) => node.kind === kind)
      .sort((a, b) => a.id.localeCompare(b.id));
    lines.push('', `${KIND_LABELS[kind]} (${nodes.length}):`);
    if (nodes.length === 0) {
      lines.push('  (none)');
      continue;
    }
    for (const node of nodes) {
      const relations = (edgesByFrom.get(node.id) ?? [])
        .map((edge) => `${edge.relation} ${nameById.get(edge.to) ?? edge.to}`)
        .sort();
      const relationPart = relations.length > 0 ? ` [${relations.join('; ')}]` : '';
      lines.push(`  - ${node.name}${renderData(node.data)}${relationPart}`);
    }
  }

  const regionCount = graph.nodes.filter((node) => node.kind === 'region').length;
  const zoneCount = graph.nodes.filter((node) => node.kind === 'zone').length;
  if (regionCount > 0 || zoneCount > 0) {
    lines.push('', `Catalog: ${regionCount} region(s), ${zoneCount} zone(s) available.`);
  }

  const unavailable = graph.slices
    .filter((slice) => slice.status === 'unavailable')
    .sort((a, b) => a.slice.localeCompare(b.slice));
  if (unavailable.length > 0) {
    lines.push('', 'Unavailable slices (could not be read — an empty result is not the same as none):');
    for (const slice of unavailable) {
      lines.push(`  - ${slice.slice}: ${slice.reason ?? 'unknown reason'}`);
    }
  }

  return lines.join('\n');
}
