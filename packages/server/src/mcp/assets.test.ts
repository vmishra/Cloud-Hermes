import { describe, it, expect } from 'vitest';
import { normalizeAssets } from './assets';

describe('normalizeAssets', () => {
  it('normalizes a bare array of assets into asset nodes', () => {
    const fragment = normalizeAssets([
      {
        name: '//storage.googleapis.com/projects/demo/buckets/data',
        assetType: 'storage.googleapis.com/Bucket',
        displayName: 'data',
        location: 'us-central1',
      },
    ]);
    expect(fragment.nodes).toHaveLength(1);
    expect(fragment.nodes[0]).toMatchObject({
      id: '//storage.googleapis.com/projects/demo/buckets/data',
      kind: 'asset',
      name: 'data',
    });
    expect(fragment.nodes[0]?.data).toMatchObject({
      assetType: 'storage.googleapis.com/Bucket',
      location: 'us-central1',
    });
  });

  it('skips asset types the gcloud slices already cover in detail', () => {
    const fragment = normalizeAssets([
      { name: '//compute.googleapis.com/.../networks/core', assetType: 'compute.googleapis.com/Network' },
      { name: '//compute.googleapis.com/.../instances/vm', assetType: 'compute.googleapis.com/Instance' },
      { name: '//sqladmin.googleapis.com/.../instances/db', assetType: 'sqladmin.googleapis.com/Instance' },
    ]);
    expect(fragment.nodes.map((node) => node.name)).toEqual(['db']);
  });

  it('reads assets out of a wrapped envelope', () => {
    const wrapped = normalizeAssets({
      results: [{ name: '//run.googleapis.com/.../services/api', assetType: 'run.googleapis.com/Service' }],
    });
    expect(wrapped.nodes).toHaveLength(1);
    expect(normalizeAssets({ assets: [] }).nodes).toEqual([]);
  });

  it('falls back to the last name segment when there is no displayName', () => {
    const fragment = normalizeAssets([
      { name: '//run.googleapis.com/projects/demo/locations/us/services/api', assetType: 'run.googleapis.com/Service' },
    ]);
    expect(fragment.nodes[0]?.name).toBe('api');
  });

  it('yields an empty fragment for a malformed or unrecognized shape', () => {
    expect(normalizeAssets('not an inventory')).toEqual({ nodes: [], edges: [] });
    expect(normalizeAssets(null)).toEqual({ nodes: [], edges: [] });
    expect(normalizeAssets([{ assetType: 'x.googleapis.com/Y' }])).toEqual({ nodes: [], edges: [] });
  });
});
