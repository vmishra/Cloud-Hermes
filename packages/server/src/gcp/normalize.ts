import { z } from 'zod';
import type { GraphEdge, GraphNode } from '@cloud-hermes/core';

/**
 * Normalization — raw gcloud JSON into resource-graph fragments.
 *
 * Pure functions, one per sync slice. They are defensive: a shape that does not
 * parse yields an empty fragment rather than throwing, so one malformed slice
 * never derails a sync. Node ids are gcloud `selfLink` URLs, which makes the
 * edges fall out for free — a subnet's `network` field *is* the network node's
 * id.
 */

export interface GraphFragment {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const EMPTY_FRAGMENT: GraphFragment = { nodes: [], edges: [] };

/** The last path segment of a gcloud resource URL — `.../regions/us-central1`
 *  becomes `us-central1`. */
export function shortName(value: string | undefined): string {
  if (!value) return '';
  const segments = value.split('/');
  return segments[segments.length - 1] ?? value;
}

const NetworkRaw = z.object({
  name: z.string(),
  selfLink: z.string().optional(),
  autoCreateSubnetworks: z.boolean().optional(),
  mtu: z.number().optional(),
});

export function normalizeNetworks(raw: unknown): GraphFragment {
  const parsed = z.array(NetworkRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  const nodes = parsed.data.map((network): GraphNode => {
    const subnetMode =
      network.autoCreateSubnetworks === false
        ? 'custom'
        : network.autoCreateSubnetworks === true
          ? 'auto'
          : 'unknown';
    return {
      id: network.selfLink ?? network.name,
      kind: 'network',
      name: network.name,
      data: { subnetMode, ...(network.mtu !== undefined ? { mtu: network.mtu } : {}) },
    };
  });
  return { nodes, edges: [] };
}

const SubnetRaw = z.object({
  name: z.string(),
  selfLink: z.string().optional(),
  network: z.string().optional(),
  ipCidrRange: z.string().optional(),
  region: z.string().optional(),
});

export function normalizeSubnets(raw: unknown): GraphFragment {
  const parsed = z.array(SubnetRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const subnet of parsed.data) {
    const id = subnet.selfLink ?? subnet.name;
    nodes.push({
      id,
      kind: 'subnet',
      name: subnet.name,
      data: {
        ...(subnet.ipCidrRange ? { range: subnet.ipCidrRange } : {}),
        ...(subnet.region ? { region: shortName(subnet.region) } : {}),
      },
    });
    if (subnet.network) {
      edges.push({ from: id, to: subnet.network, relation: 'in-network' });
    }
  }
  return { nodes, edges };
}

const InstanceRaw = z.object({
  name: z.string(),
  selfLink: z.string().optional(),
  machineType: z.string().optional(),
  zone: z.string().optional(),
  status: z.string().optional(),
  networkInterfaces: z
    .array(
      z.object({
        network: z.string().optional(),
        subnetwork: z.string().optional(),
        networkIP: z.string().optional(),
      }),
    )
    .optional(),
});

export function normalizeInstances(raw: unknown): GraphFragment {
  const parsed = z.array(InstanceRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const instance of parsed.data) {
    const id = instance.selfLink ?? instance.name;
    nodes.push({
      id,
      kind: 'instance',
      name: instance.name,
      data: {
        ...(instance.machineType ? { machineType: shortName(instance.machineType) } : {}),
        ...(instance.zone ? { zone: shortName(instance.zone) } : {}),
        ...(instance.status ? { status: instance.status } : {}),
      },
    });
    const primary = instance.networkInterfaces?.[0];
    if (primary?.subnetwork) {
      edges.push({ from: id, to: primary.subnetwork, relation: 'in-subnet' });
    } else if (primary?.network) {
      edges.push({ from: id, to: primary.network, relation: 'in-network' });
    }
  }
  return { nodes, edges };
}

const FirewallRaw = z.object({
  name: z.string(),
  selfLink: z.string().optional(),
  network: z.string().optional(),
  direction: z.string().optional(),
  priority: z.number().optional(),
  sourceRanges: z.array(z.string()).optional(),
  allowed: z
    .array(z.object({ IPProtocol: z.string(), ports: z.array(z.string()).optional() }))
    .optional(),
});

export function normalizeFirewalls(raw: unknown): GraphFragment {
  const parsed = z.array(FirewallRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  for (const rule of parsed.data) {
    const id = rule.selfLink ?? rule.name;
    const allowed = (rule.allowed ?? [])
      .map((entry) =>
        entry.ports && entry.ports.length > 0
          ? entry.ports.map((port) => `${entry.IPProtocol}:${port}`).join(',')
          : entry.IPProtocol,
      )
      .join(',');
    nodes.push({
      id,
      kind: 'firewall-rule',
      name: rule.name,
      data: {
        ...(rule.direction ? { direction: rule.direction } : {}),
        ...(rule.priority !== undefined ? { priority: rule.priority } : {}),
        ...(rule.sourceRanges ? { sourceRanges: rule.sourceRanges.join(',') } : {}),
        ...(allowed ? { allowed } : {}),
      },
    });
    if (rule.network) {
      edges.push({ from: id, to: rule.network, relation: 'applies-to' });
    }
  }
  return { nodes, edges };
}

const ProjectRaw = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  projectNumber: z.union([z.string(), z.number()]).optional(),
  lifecycleState: z.string().optional(),
});

export function normalizeProject(raw: unknown): GraphFragment {
  const parsed = ProjectRaw.safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  const project = parsed.data;
  return {
    nodes: [
      {
        id: project.projectId,
        kind: 'project',
        name: project.name ?? project.projectId,
        data: {
          projectId: project.projectId,
          ...(project.projectNumber !== undefined
            ? { projectNumber: String(project.projectNumber) }
            : {}),
          ...(project.lifecycleState ? { lifecycleState: project.lifecycleState } : {}),
        },
      },
    ],
    edges: [],
  };
}

const RegionRaw = z.object({ name: z.string(), status: z.string().optional() });

export function normalizeRegions(raw: unknown): GraphFragment {
  const parsed = z.array(RegionRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  return {
    nodes: parsed.data.map((region): GraphNode => ({
      id: region.name,
      kind: 'region',
      name: region.name,
      data: region.status ? { status: region.status } : {},
    })),
    edges: [],
  };
}

const ZoneRaw = z.object({
  name: z.string(),
  status: z.string().optional(),
  region: z.string().optional(),
});

export function normalizeZones(raw: unknown): GraphFragment {
  const parsed = z.array(ZoneRaw).safeParse(raw);
  if (!parsed.success) return EMPTY_FRAGMENT;
  return {
    nodes: parsed.data.map((zone): GraphNode => ({
      id: zone.name,
      kind: 'zone',
      name: zone.name,
      data: {
        ...(zone.region ? { region: shortName(zone.region) } : {}),
        ...(zone.status ? { status: zone.status } : {}),
      },
    })),
    edges: [],
  };
}
