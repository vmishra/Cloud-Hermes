import { describe, it, expect } from 'vitest';
import {
  normalizeNetworks,
  normalizeSubnets,
  normalizeInstances,
  normalizeFirewalls,
  normalizeProject,
  normalizeRegions,
  normalizeZones,
  shortName,
} from './normalize';

const NET_LINK = 'https://www.googleapis.com/compute/v1/projects/demo/global/networks/core';
const SUB_LINK = 'https://www.googleapis.com/compute/v1/projects/demo/regions/us-central1/subnetworks/sub-a';

describe('shortName', () => {
  it('returns the last path segment of a resource URL', () => {
    expect(shortName('https://x/regions/us-central1')).toBe('us-central1');
    expect(shortName(undefined)).toBe('');
  });
});

describe('normalizeNetworks', () => {
  it('produces a network node with its subnet mode', () => {
    const fragment = normalizeNetworks([
      { name: 'core', selfLink: NET_LINK, autoCreateSubnetworks: false },
    ]);
    expect(fragment.nodes).toHaveLength(1);
    expect(fragment.nodes[0]).toMatchObject({ id: NET_LINK, kind: 'network', name: 'core' });
    expect(fragment.nodes[0]?.data['subnetMode']).toBe('custom');
  });

  it('yields an empty fragment for a malformed shape', () => {
    expect(normalizeNetworks({ not: 'an array' })).toEqual({ nodes: [], edges: [] });
  });
});

describe('normalizeSubnets', () => {
  it('links a subnet to its network by selfLink', () => {
    const fragment = normalizeSubnets([
      { name: 'sub-a', selfLink: SUB_LINK, network: NET_LINK, ipCidrRange: '10.0.0.0/20', region: 'https://x/regions/us-central1' },
    ]);
    expect(fragment.nodes[0]).toMatchObject({ id: SUB_LINK, kind: 'subnet' });
    expect(fragment.nodes[0]?.data['range']).toBe('10.0.0.0/20');
    expect(fragment.edges).toEqual([{ from: SUB_LINK, to: NET_LINK, relation: 'in-network' }]);
  });
});

describe('normalizeInstances', () => {
  it('links an instance to its subnet', () => {
    const fragment = normalizeInstances([
      {
        name: 'web',
        selfLink: 'vm-link',
        machineType: 'https://x/machineTypes/e2-medium',
        zone: 'https://x/zones/us-central1-a',
        status: 'RUNNING',
        networkInterfaces: [{ subnetwork: SUB_LINK }],
      },
    ]);
    expect(fragment.nodes[0]?.data).toMatchObject({ machineType: 'e2-medium', zone: 'us-central1-a', status: 'RUNNING' });
    expect(fragment.edges).toEqual([{ from: 'vm-link', to: SUB_LINK, relation: 'in-subnet' }]);
  });
});

describe('normalizeFirewalls', () => {
  it('produces a firewall node with a flattened allow list and a network edge', () => {
    const fragment = normalizeFirewalls([
      {
        name: 'allow-ssh',
        selfLink: 'fw-link',
        network: NET_LINK,
        direction: 'INGRESS',
        sourceRanges: ['0.0.0.0/0'],
        allowed: [{ IPProtocol: 'tcp', ports: ['22'] }],
      },
    ]);
    expect(fragment.nodes[0]?.data).toMatchObject({ direction: 'INGRESS', sourceRanges: '0.0.0.0/0', allowed: 'tcp:22' });
    expect(fragment.edges).toEqual([{ from: 'fw-link', to: NET_LINK, relation: 'applies-to' }]);
  });
});

describe('normalizeProject, normalizeRegions, normalizeZones', () => {
  it('normalizes a project description', () => {
    const fragment = normalizeProject({ projectId: 'demo', name: 'Demo', lifecycleState: 'ACTIVE' });
    expect(fragment.nodes[0]).toMatchObject({ id: 'demo', kind: 'project', name: 'Demo' });
  });

  it('normalizes regions and zones', () => {
    expect(normalizeRegions([{ name: 'us-central1', status: 'UP' }]).nodes[0]?.kind).toBe('region');
    const zones = normalizeZones([{ name: 'us-central1-a', region: 'https://x/regions/us-central1', status: 'UP' }]);
    expect(zones.nodes[0]?.data['region']).toBe('us-central1');
  });
});
