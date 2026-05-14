import { describe, it, expect } from 'vitest';
import type { ResourceGraph } from '../schemas/graph';
import { findNode, directDependents, blastRadius, summarizeGraph } from './graph';

const graph: ResourceGraph = {
  projectId: 'demo',
  syncedAt: '2026-05-15T00:00:00.000Z',
  nodes: [
    { id: 'net/core', kind: 'network', name: 'core', data: { subnetMode: 'custom' } },
    { id: 'sub/a', kind: 'subnet', name: 'sub-a', data: { range: '10.0.0.0/20', region: 'us-central1' } },
    { id: 'sub/b', kind: 'subnet', name: 'sub-b', data: { range: '10.0.16.0/20', region: 'us-east1' } },
    { id: 'vm/web', kind: 'instance', name: 'web', data: { machineType: 'e2-medium', status: 'RUNNING' } },
    { id: 'fw/ssh', kind: 'firewall-rule', name: 'allow-ssh', data: { sourceRanges: '0.0.0.0/0' } },
  ],
  edges: [
    { from: 'sub/a', to: 'net/core', relation: 'in-network' },
    { from: 'sub/b', to: 'net/core', relation: 'in-network' },
    { from: 'vm/web', to: 'sub/a', relation: 'in-subnet' },
    { from: 'fw/ssh', to: 'net/core', relation: 'applies-to' },
  ],
  slices: [
    { slice: 'compute-networks', status: 'ok' },
    { slice: 'compute-firewall-rules', status: 'unavailable', reason: 'Compute API not enabled' },
  ],
};

describe('graph queries', () => {
  it('finds a node by id', () => {
    expect(findNode(graph, 'net/core')?.name).toBe('core');
    expect(findNode(graph, 'missing')).toBeUndefined();
  });

  it('lists direct dependents', () => {
    const dependents = directDependents(graph, 'net/core').map((node) => node.id).sort();
    expect(dependents).toEqual(['fw/ssh', 'sub/a', 'sub/b']);
  });

  it('computes the transitive blast radius of a network', () => {
    const radius = blastRadius(graph, 'net/core').map((node) => node.id).sort();
    expect(radius).toEqual(['fw/ssh', 'net/core', 'sub/a', 'sub/b', 'vm/web']);
  });

  it('computes a narrower blast radius for a subnet', () => {
    const radius = blastRadius(graph, 'sub/a').map((node) => node.id).sort();
    expect(radius).toEqual(['sub/a', 'vm/web']);
  });

  it('returns an empty blast radius for an unknown node', () => {
    expect(blastRadius(graph, 'missing')).toEqual([]);
  });
});

describe('summarizeGraph', () => {
  it('produces a deterministic summary', () => {
    expect(summarizeGraph(graph)).toBe(summarizeGraph(graph));
  });

  it('includes resources and surfaces unavailable slices', () => {
    const summary = summarizeGraph(graph);
    expect(summary).toContain('Project: demo');
    expect(summary).toContain('Networks (1):');
    expect(summary).toContain('sub-a');
    expect(summary).toContain('in-network core');
    expect(summary).toContain('compute-firewall-rules: Compute API not enabled');
  });
});
