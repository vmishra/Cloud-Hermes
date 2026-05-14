import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The audit log.
 *
 * Append-only, one JSON record per line, in the workspace directory. Two
 * records are written for every mutation — one at classification (the verdict
 * and which gate decided it) and one at execution (the outcome) — linked by a
 * shared id. Together they answer "why was this allowed, and what happened?"
 * for free.
 */

export type AuditPhase = 'classification' | 'execution';

export interface AuditRecord {
  /** ISO-8601 timestamp. */
  at: string;
  phase: AuditPhase;
  /** Links the classification record to its execution record. */
  classificationId: string;
  workspaceId: string;
  /** The exact argv that was classified or executed. */
  argv: string[];
  classification: string;
  /** Which classifier gate decided — set on the classification record. */
  decidedBy?: string;
  reason?: string;
  /** The execution outcome — set on the execution record. */
  outcome?: string;
}

const AUDIT_FILENAME = 'audit.log';

/**
 * Appends one record to a workspace's audit log. An audit-write failure is
 * reported to the caller but never blocks the operation itself.
 */
export async function appendAudit(
  workspaceDir: string,
  record: AuditRecord,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await appendFile(join(workspaceDir, AUDIT_FILENAME), `${JSON.stringify(record)}\n`, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
