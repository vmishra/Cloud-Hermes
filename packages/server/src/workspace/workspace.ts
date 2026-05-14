import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { ResourceGraph, Workspace, type HarnessId } from '@cloud-hermes/core';

/**
 * The workspace store.
 *
 * A workspace is the unit Cloud Hermes operates in — one Google Cloud project,
 * one reasoning harness. Each workspace is a directory under the workspaces
 * root holding its config, synced state, conversation markdown, and memory.
 * Everything is plain files on disk: markdown and JSON are the source of truth.
 *
 * The store is built around an injectable root so it can be exercised against
 * a temporary directory in tests.
 */

export interface CreateWorkspaceInput {
  name: string;
  projectId: string;
  harness: HarnessId;
}

export interface WorkspaceStore {
  readonly root: string;
  dir(id: string): string;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  load(id: string): Promise<Workspace | null>;
  list(): Promise<Workspace[]>;
  saveGraph(id: string, graph: ResourceGraph, raw: unknown): Promise<void>;
  loadGraph(id: string): Promise<ResourceGraph | null>;
}

export function createWorkspaceStore(root: string): WorkspaceStore {
  const dir = (id: string): string => join(root, id);

  const load = async (id: string): Promise<Workspace | null> => {
    try {
      const text = await readFile(join(dir(id), 'workspace.json'), 'utf8');
      const parsed = Workspace.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  return {
    root,
    dir,
    load,

    async create(input) {
      const workspace: Workspace = {
        id: randomUUID(),
        name: input.name,
        projectId: input.projectId,
        harness: input.harness,
        createdAt: new Date().toISOString(),
      };
      const base = dir(workspace.id);
      await mkdir(join(base, 'state'), { recursive: true });
      await mkdir(join(base, 'conversations'), { recursive: true });
      await mkdir(join(base, 'memory'), { recursive: true });
      await writeFile(
        join(base, 'workspace.json'),
        `${JSON.stringify(workspace, null, 2)}\n`,
        'utf8',
      );
      return workspace;
    },

    async list() {
      let entries: string[];
      try {
        entries = await readdir(root);
      } catch {
        return [];
      }
      const workspaces: Workspace[] = [];
      for (const entry of entries) {
        const workspace = await load(entry);
        if (workspace) workspaces.push(workspace);
      }
      return workspaces.sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      );
    },

    async saveGraph(id, graph, raw) {
      const stateDir = join(dir(id), 'state');
      await mkdir(stateDir, { recursive: true });
      await writeFile(join(stateDir, 'graph.json'), `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
      await writeFile(join(stateDir, 'raw.json'), `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    },

    async loadGraph(id) {
      try {
        const text = await readFile(join(dir(id), 'state', 'graph.json'), 'utf8');
        const parsed = ResourceGraph.safeParse(JSON.parse(text));
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}
