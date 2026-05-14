import { z } from 'zod';
import type { GraphNode } from '@cloud-hermes/core';
import type { GraphFragment } from '../gcp/normalize';

/**
 * Normalizes a Cloud Asset Inventory result into resource-graph nodes.
 *
 * Pure and defensive: text in (whatever shape the MCP tool returned), graph
 * fragment out — an unrecognized shape yields an empty fragment rather than
 * throwing. Asset types the gcloud sync slices already cover in detail are
 * skipped, so the MCP slice purely adds breadth and never duplicates a node.
 */

/** Asset types the gcloud slices already produce as fully-typed nodes. */
const COVERED_ASSET_TYPES = new Set<string>([
  'compute.googleapis.com/Network',
  'compute.googleapis.com/Subnetwork',
  'compute.googleapis.com/Instance',
  'compute.googleapis.com/Firewall',
]);

const AssetSchema = z.object({
  name: z.string().optional(),
  assetType: z.string().optional(),
  displayName: z.string().optional(),
  location: z.string().optional(),
});

/** Pulls an array of asset-like objects out of whatever envelope the MCP tool
 *  returned — a bare array, or wrapped under a common key. */
function extractAssetArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw !== null && typeof raw === 'object') {
    for (const key of ['assets', 'results', 'resources', 'items']) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

const lastSegment = (value: string): string => value.split('/').filter(Boolean).at(-1) ?? value;

export function normalizeAssets(raw: unknown): GraphFragment {
  const nodes: GraphNode[] = [];
  for (const entry of extractAssetArray(raw)) {
    const parsed = AssetSchema.safeParse(entry);
    if (!parsed.success) continue;
    const asset = parsed.data;
    if (asset.assetType === undefined || asset.name === undefined) continue;
    if (COVERED_ASSET_TYPES.has(asset.assetType)) continue;
    nodes.push({
      id: asset.name,
      kind: 'asset',
      name: asset.displayName ?? lastSegment(asset.name),
      data: {
        assetType: asset.assetType,
        ...(asset.location ? { location: asset.location } : {}),
      },
    });
  }
  return { nodes, edges: [] };
}
