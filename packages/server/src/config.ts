import { join } from 'node:path';

/** Server configuration, resolved from the environment with sensible defaults. */
export const SERVER_VERSION = '0.0.0';
export const HOST = process.env.HOST ?? '127.0.0.1';
export const PORT = Number(process.env.PORT ?? 4317);

/**
 * Where runtime workspace data lives — workspace config, synced state, the
 * conversation markdown, memory, and the audit log. Defaults to a `workspaces`
 * directory at the repository root, regardless of the process's cwd, and is
 * gitignored.
 */
export const WORKSPACES_DIR =
  process.env.CLOUD_HERMES_WORKSPACES_DIR ?? join(import.meta.dirname, '../../../workspaces');

/** The built-in skill catalog — the `@cloud-hermes/skills` package directory. */
export const SKILLS_DIR =
  process.env.CLOUD_HERMES_SKILLS_DIR ?? join(import.meta.dirname, '../../skills');

