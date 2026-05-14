import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ResourceGraph } from '@cloud-hermes/core';
import { createWorkspaceStore } from './workspace';

describe('createWorkspaceStore', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ch-workspace-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates a workspace and loads it back', async () => {
    const store = createWorkspaceStore(root);
    const created = await store.create({ name: 'Prod', projectId: 'my-project', harness: 'claude' });
    expect(created.id).toBeTruthy();
    expect(created.name).toBe('Prod');
    expect(await store.load(created.id)).toEqual(created);
  });

  it('lists every created workspace', async () => {
    const store = createWorkspaceStore(root);
    const a = await store.create({ name: 'A', projectId: 'proj-alpha', harness: 'claude' });
    const b = await store.create({ name: 'B', projectId: 'proj-bravo', harness: 'gemini' });
    const ids = (await store.list()).map((workspace) => workspace.id).sort();
    expect(ids).toEqual([a.id, b.id].sort());
  });

  it('returns null for a workspace that does not exist', async () => {
    const store = createWorkspaceStore(root);
    expect(await store.load('missing')).toBeNull();
    expect(await store.loadGraph('missing')).toBeNull();
  });

  it('saves and loads the resource graph', async () => {
    const store = createWorkspaceStore(root);
    const workspace = await store.create({ name: 'G', projectId: 'proj-graph', harness: 'claude' });
    const graph: ResourceGraph = {
      projectId: 'proj-graph',
      syncedAt: '2026-05-15T00:00:00.000Z',
      nodes: [],
      edges: [],
      slices: [],
    };
    await store.saveGraph(workspace.id, graph, { networks: [] });
    expect(await store.loadGraph(workspace.id)).toEqual(graph);
  });

  it('returns an empty list when the root does not exist yet', async () => {
    const store = createWorkspaceStore(join(root, 'not-created-yet'));
    expect(await store.list()).toEqual([]);
  });
});
