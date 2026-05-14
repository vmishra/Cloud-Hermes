import { mkdir, readFile, readdir, appendFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The conversation store.
 *
 * Each conversation is one markdown file under the workspace's `conversations`
 * directory — the source of truth. A small frontmatter block (id, title,
 * created-at) is written once; turns are appended as markdown sections, and the
 * file's modification time stands in for "updated at", so a turn is a pure
 * append, never a rewrite.
 */

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface ConversationStore {
  recordUser(workspaceId: string, conversationId: string, text: string): Promise<void>;
  recordHermes(workspaceId: string, conversationId: string, markdown: string): Promise<void>;
  list(workspaceId: string): Promise<ConversationSummary[]>;
  load(workspaceId: string, conversationId: string): Promise<string | null>;
}

/** Collapses a user message into a one-line, frontmatter-safe title. */
function toTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim().replace(/^-+/, '').trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}...` : oneLine || 'Untitled conversation';
}

/** Reads `id` and `title` from a conversation file's flat frontmatter. */
function parseMeta(text: string): { id: string; title: string } | null {
  const unified = text.split('\r\n').join('\n');
  if (!unified.startsWith('---\n')) return null;
  const close = unified.indexOf('\n---', 4);
  if (close === -1) return null;
  const fields: Record<string, string> = {};
  for (const line of unified.slice(4, close).split('\n')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  if (fields['id'] === undefined) return null;
  return { id: fields['id'], title: fields['title'] ?? 'Untitled conversation' };
}

export function createConversationStore(workspacesRoot: string): ConversationStore {
  const dir = (workspaceId: string): string =>
    join(workspacesRoot, workspaceId, 'conversations');
  const file = (workspaceId: string, conversationId: string): string =>
    join(dir(workspaceId), `${conversationId}.md`);

  const append = async (
    workspaceId: string,
    conversationId: string,
    section: string,
    titleIfNew: string,
  ): Promise<void> => {
    const path = file(workspaceId, conversationId);
    await mkdir(dir(workspaceId), { recursive: true });
    let exists = true;
    try {
      await stat(path);
    } catch {
      exists = false;
    }
    if (!exists) {
      const frontmatter = [
        '---',
        `id: ${conversationId}`,
        `title: ${titleIfNew}`,
        `createdAt: ${new Date().toISOString()}`,
        '---',
        '',
      ].join('\n');
      await writeFile(path, frontmatter, 'utf8');
    }
    await appendFile(path, `${section}\n`, 'utf8');
  };

  return {
    async recordUser(workspaceId, conversationId, text) {
      await append(workspaceId, conversationId, `\n## You\n\n${text}\n`, toTitle(text));
    },

    async recordHermes(workspaceId, conversationId, markdown) {
      await append(workspaceId, conversationId, `\n## Hermes\n\n${markdown}\n`, 'Untitled conversation');
    },

    async list(workspaceId) {
      let files: string[];
      try {
        files = (await readdir(dir(workspaceId))).filter((name) => name.endsWith('.md'));
      } catch {
        return [];
      }
      const summaries: ConversationSummary[] = [];
      for (const name of files) {
        const path = join(dir(workspaceId), name);
        try {
          const [text, stats] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
          const meta = parseMeta(text);
          if (meta !== null) {
            summaries.push({ id: meta.id, title: meta.title, updatedAt: stats.mtime.toISOString() });
          }
        } catch {
          // a single unreadable conversation file does not derail the list
        }
      }
      return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async load(workspaceId, conversationId) {
      try {
        return await readFile(file(workspaceId, conversationId), 'utf8');
      } catch {
        return null;
      }
    },
  };
}
