import { spawn, type ChildProcess } from 'node:child_process';
import { HermesError } from '@cloud-hermes/core';

/**
 * The single subprocess boundary.
 *
 * Every process Cloud Hermes runs — the reasoning CLI, `gcloud`, `terraform` —
 * goes through here. The discipline this enforces is the foundation of the
 * safety story:
 *
 *  - argv only, `shell: false` — a command is never reconstructed into a
 *    string, so there is no shell to inject into;
 *  - an explicit `cwd` and a filtered, allowlisted environment — children
 *    never inherit the full `process.env`, so secrets do not leak into them;
 *  - a hard deadline with `SIGTERM -> grace -> SIGKILL` escalation, and an
 *    `AbortSignal` for cancellation, so a spawn is always reachable and a hung
 *    child can never hang the caller;
 *  - stdout captured whole (the structured channel); stderr kept as a bounded
 *    ring buffer (its tail feeds the error taxonomy);
 *  - early-exit detection — a child that dies immediately with stderr fails
 *    fast rather than waiting out the full timeout.
 */

/** Environment variables every subprocess may inherit. Anything not on a
 *  provider's combined allowlist is dropped. */
export const DEFAULT_ENV_ALLOWLIST: readonly string[] = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TMPDIR',
  'TERM',
];

const STDERR_TAIL_LINES = 40;
const KILL_GRACE_MS = 2_000;

export interface SubprocessOptions {
  bin: string;
  args: string[];
  /** Written to the child's stdin, which is then closed. */
  stdin?: string;
  cwd: string;
  /** Env var names the child may inherit; defaults to {@link DEFAULT_ENV_ALLOWLIST}. */
  envAllowlist?: readonly string[];
  /** Extra env vars set explicitly on the child. */
  env?: Record<string, string>;
  /** Hard deadline; the child is killed if exceeded. */
  timeoutMs: number;
  /** Cancellation — wired to the UI abort button. */
  signal?: AbortSignal;
  /** Live output streaming, for the terminal view. */
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface SubprocessResult {
  stdout: string;
  /** The last {@link STDERR_TAIL_LINES} lines of stderr, trimmed. */
  stderrTail: string;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  durationMs: number;
  /** True if the deadline was hit; the child was killed. */
  timedOut: boolean;
  /** True if cancelled via the `AbortSignal`. */
  aborted: boolean;
}

function buildEnv(
  allowlist: readonly string[],
  extra: Record<string, string>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowlist) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}

/**
 * Runs a subprocess to completion. Resolves with a {@link SubprocessResult} for
 * every termination — including a non-zero exit or a timeout — so the caller
 * decides what counts as failure. Rejects only when the binary cannot be
 * started at all (`cli-not-found`).
 */
export function runSubprocess(opts: SubprocessOptions): Promise<SubprocessResult> {
  const startedAt = Date.now();
  const env = buildEnv(opts.envAllowlist ?? DEFAULT_ENV_ALLOWLIST, opts.env ?? {});

  return new Promise<SubprocessResult>((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(opts.bin, opts.args, {
        cwd: opts.cwd,
        env,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      reject(
        new HermesError('cli-not-found', `Could not start '${opts.bin}'.`, String(err)),
      );
      return;
    }

    let stdout = '';
    const stderrRing: string[] = [];
    let timedOut = false;
    let aborted = false;
    let settled = false;

    const pushStderr = (text: string): void => {
      for (const line of text.split('\n')) {
        stderrRing.push(line);
        if (stderrRing.length > STDERR_TAIL_LINES) stderrRing.shift();
      }
    };

    // SIGTERM, then escalate to SIGKILL if the child has not exited.
    const killChild = (): void => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, KILL_GRACE_MS).unref();
    };

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killChild();
    }, opts.timeoutMs);

    const onAbort = (): void => {
      aborted = true;
      killChild();
    };
    if (opts.signal) {
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    const cleanup = (): void => {
      clearTimeout(timeoutTimer);
      opts.signal?.removeEventListener('abort', onAbort);
    };

    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
      opts.onStdout?.(chunk);
    });

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      pushStderr(chunk);
      opts.onStderr?.(chunk);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new HermesError('cli-not-found', `'${opts.bin}' failed to start.`, err.message),
      );
    });

    child.on('close', (code, signalCode) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        stdout,
        stderrTail: stderrRing.join('\n').trim(),
        exitCode: code,
        signalCode,
        durationMs: Date.now() - startedAt,
        timedOut,
        aborted,
      });
    });

    if (opts.stdin !== undefined) child.stdin?.write(opts.stdin);
    child.stdin?.end();
  });
}
