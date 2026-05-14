/**
 * Foundational shared types that are not Zod schemas — the error taxonomy and
 * the operating-loop vocabulary.
 */

/**
 * The structured error taxonomy for subprocess and harness failures. Every
 * failure path resolves to one of these so the UI can render a precise,
 * actionable state instead of a generic crash.
 */
export type HermesErrorCode =
  | 'cli-not-found'
  | 'auth-incomplete'
  | 'non-zero-exit'
  | 'timeout'
  | 'malformed-output'
  | 'schema-invalid'
  | 'blocked-by-guard'
  | 'blocked-by-policy';

export class HermesError extends Error {
  constructor(
    public readonly code: HermesErrorCode,
    message: string,
    /** Optional diagnostic detail — e.g. the tail of a subprocess's stderr. */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'HermesError';
  }
}

/**
 * The four stages of the operating loop, surfaced in the UI so the operator
 * always knows where they are. Converse mode is the Observe-to-answer path;
 * Create mode runs the full loop.
 */
export const OPERATING_LOOP_STAGES = ['observe', 'plan', 'execute', 'learn'] as const;
export type OperatingLoopStage = (typeof OPERATING_LOOP_STAGES)[number];
