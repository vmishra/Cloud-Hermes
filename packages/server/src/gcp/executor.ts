import { randomUUID } from 'node:crypto';
import {
  redactSecrets,
  HermesError,
  type ClassifiedCommand,
  type TerminalSource,
} from '@cloud-hermes/core';
import { DEFAULT_ENV_ALLOWLIST, runSubprocess } from '../harness/spawn';

/**
 * The guarded gcloud executor.
 *
 * `runGcloud` is the mechanism: it runs gcloud through the spawn engine —
 * argv-only, no shell, a filtered environment — and streams output to the
 * terminal view through the secret redactor. The raw stdout returned to Hermes
 * is left intact so it can still be parsed; redaction happens only at the
 * boundary, where output reaches a human or the model.
 *
 * `executeClassified` is the chokepoint: a command the safety guard did not
 * positively classify as runnable never reaches gcloud.
 */

const GCLOUD_BIN = 'gcloud';
const DEFAULT_GCLOUD_TIMEOUT_MS = 120_000;

/** gcloud-specific environment variables, added to the base allowlist. */
const GCLOUD_ENV_EXTRA: readonly string[] = [
  'CLOUDSDK_CONFIG',
  'CLOUDSDK_CORE_PROJECT',
  'CLOUDSDK_ACTIVE_CONFIG_NAME',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'GOOGLE_CLOUD_PROJECT',
  'GCLOUD_PROJECT',
];

export interface TerminalEvent {
  commandId: string;
  source: TerminalSource;
  stream: 'stdout' | 'stderr';
  /** Already passed through the secret redactor — safe to display. */
  chunk: string;
}

export interface GcloudExecOptions {
  /** Identifies this command in the terminal view; defaults to a fresh id. */
  commandId?: string;
  /** The terminal-view source label; defaults to `gcloud`. */
  source?: TerminalSource;
  /** Receives redacted output chunks for the live terminal view. */
  onTerminal?: (event: TerminalEvent) => void;
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface GcloudResult {
  /** Raw stdout — not redacted, so Hermes can parse it (e.g. as JSON). */
  stdout: string;
  stderrTail: string;
  exitCode: number | null;
  durationMs: number;
  timedOut: boolean;
  aborted: boolean;
  /** True when the command exited cleanly and was neither timed out nor aborted. */
  ok: boolean;
}

export async function runGcloud(
  argv: readonly string[],
  options: GcloudExecOptions = {},
): Promise<GcloudResult> {
  const commandId = options.commandId ?? randomUUID();
  const source: TerminalSource = options.source ?? 'gcloud';
  const emit = (stream: 'stdout' | 'stderr', chunk: string): void => {
    options.onTerminal?.({ commandId, source, stream, chunk: redactSecrets(chunk) });
  };

  // The exact command line, shown first.
  emit('stdout', `$ ${GCLOUD_BIN} ${argv.join(' ')}\n`);

  const result = await runSubprocess({
    bin: GCLOUD_BIN,
    args: [...argv],
    cwd: options.cwd ?? process.cwd(),
    envAllowlist: [...DEFAULT_ENV_ALLOWLIST, ...GCLOUD_ENV_EXTRA],
    timeoutMs: options.timeoutMs ?? DEFAULT_GCLOUD_TIMEOUT_MS,
    signal: options.signal,
    onStdout: (chunk) => emit('stdout', chunk),
    onStderr: (chunk) => emit('stderr', chunk),
  });

  return {
    stdout: result.stdout,
    stderrTail: result.stderrTail,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    aborted: result.aborted,
    ok: result.exitCode === 0 && !result.timedOut && !result.aborted,
  };
}

/**
 * The single execution chokepoint. A BLOCKED command never reaches gcloud —
 * and because callers pass the already-classified verdict by reference, the
 * thing executed is provably the thing that was classified.
 */
export async function executeClassified(
  classified: ClassifiedCommand,
  options: GcloudExecOptions = {},
): Promise<GcloudResult> {
  if (classified.classification === 'BLOCKED') {
    throw new HermesError(
      'blocked-by-guard',
      'This command was blocked by the safety guard and will not be run.',
      classified.reason,
    );
  }
  return runGcloud(classified.argv, options);
}
