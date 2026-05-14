import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The memory store.
 *
 * Per-workspace memory is a single markdown file the operator can read and
 * edit — preferences and learnings that should shape future conversations.
 * Memory is an enhancement, never a dependency: a read failure yields empty
 * memory rather than blocking a turn.
 */

export interface MemoryStore {
  /** The workspace's memory markdown, or an empty string when there is none. */
  read(workspaceId: string): Promise<string>;
  write(workspaceId: string, content: string): Promise<void>;
}

export function createMemoryStore(workspacesRoot: string): MemoryStore {
  const file = (workspaceId: string): string =>
    join(workspacesRoot, workspaceId, 'memory', 'memory.md');

  return {
    async read(workspaceId) {
      try {
        return await readFile(file(workspaceId), 'utf8');
      } catch {
        return '';
      }
    },

    async write(workspaceId, content) {
      const path = file(workspaceId);
      await mkdir(join(workspacesRoot, workspaceId, 'memory'), { recursive: true });
      await writeFile(path, content, 'utf8');
    },
  };
}
