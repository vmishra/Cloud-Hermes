import { describe, it, expect } from 'vitest';
import type { ResourceGraph, GraphNode } from '../schemas/graph';
import { runInsights } from './runner';

const graphOf = (nodes: GraphNode[]): ResourceGraph => ({
  projectId: 'demo',
  syncedAt: '2026-05-15T00:00:00.000Z',
  nodes,
  edges: [],
  slices: [],
});

const firewall = (name: string, data: Record<string, unknown>): GraphNode => ({
  id: `fw/${name}`,
  kind: 'firewall-rule',
  name,
  data,
});

describe('runInsights — firewall open ingress', () => {
  it('flags 0.0.0.0/0 ingress on a sensitive port', () => {
    const insights = runInsights(
      graphOf([
        firewall('allow-ssh', {
          direction: 'INGRESS',
          sourceRanges: '0.0.0.0/0',
          allowed: 'tcp:22',
        }),
      ]),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0]?.checkId).toBe('firewall-open-ingress');
    expect(insights[0]?.severity).toBe('warning');
    expect(insights[0]?.resourceId).toBe('fw/allow-ssh');
  });

  it('does not flag a non-sensitive port or a narrow source range', () => {
    const insights = runInsights(
      graphOf([
        firewall('allow-https', { direction: 'INGRESS', sourceRanges: '0.0.0.0/0', allowed: 'tcp:443' }),
        firewall('allow-ssh-internal', {
          direction: 'INGRESS',
          sourceRanges: '10.0.0.0/8',
          allowed: 'tcp:22',
        }),
      ]),
    );
    expect(insights).toHaveLength(0);
  });
});

describe('runInsights — network and instance checks', () => {
  it('flags an auto-mode network and the default network', () => {
    const insights = runInsights(
      graphOf([
        { id: 'net/default', kind: 'network', name: 'default', data: { subnetMode: 'auto' } },
      ]),
    );
    const checkIds = insights.map((insight) => insight.checkId).sort();
    expect(checkIds).toEqual(['auto-mode-network', 'default-network']);
  });

  it('flags a legacy machine type but not a current one', () => {
    const insights = runInsights(
      graphOf([
        { id: 'vm/old', kind: 'instance', name: 'old', data: { machineType: 'n1-standard-1' } },
        { id: 'vm/new', kind: 'instance', name: 'new', data: { machineType: 'e2-medium' } },
      ]),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0]?.resourceId).toBe('vm/old');
  });
});

describe('runInsights — ordering', () => {
  it('sorts warnings first and is deterministic', () => {
    const graph = graphOf([
      { id: 'net/default', kind: 'network', name: 'default', data: { subnetMode: 'auto' } },
      firewall('allow-ssh', { direction: 'INGRESS', sourceRanges: '0.0.0.0/0', allowed: 'tcp:22' }),
    ]);
    const insights = runInsights(graph);
    expect(insights[0]?.severity).toBe('warning');
    expect(runInsights(graph)).toEqual(insights);
  });

  it('returns nothing for a clean graph', () => {
    expect(runInsights(graphOf([]))).toEqual([]);
  });
});
