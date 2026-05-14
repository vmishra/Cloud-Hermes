/**
 * The harness provider contract.
 *
 * The reasoning CLI (`claude` / `gemini`) is treated as a pure, stateless
 * reasoning function: Hermes assembles the entire prompt, the CLI returns text,
 * and Hermes extracts the structured response. The rest of the system talks to
 * the `HarnessProvider` interface and never knows it is driving a subprocess.
 *
 * Each provider is a declarative `ProviderProfile` consumed by one shared
 * spawn/parse engine — a new provider is a new profile, not new code.
 */

export type ProviderId = 'claude' | 'gemini';

/** How a CLI's JSON output envelope is shaped, so the parser knows where the
 *  model's response text lives. */
export type EnvelopeFormat = 'claude-json' | 'gemini-json';

/** A declarative description of a harness CLI. All CLI-specific assumptions are
 *  isolated here, so version drift is contained to one data object. */
export interface ProviderProfile {
  id: ProviderId;
  displayName: string;
  /** The binary name, resolved on `PATH`. */
  bin: string;
  /**
   * Fixed arguments for a non-interactive, no-tools, stateless structured
   * query. The prompt itself is always delivered on stdin — never as an argv
   * element — so the argument vector stays small, fixed, and injection-free.
   */
  baseArgs: string[];
  /** Arguments that print the version, for the doctor's self-test. */
  versionArgs: string[];
  /** How to read the response text out of this CLI's output envelope. */
  envelope: EnvelopeFormat;
  /** Minimum supported CLI version (semver), or `null` if not yet pinned. */
  versionMin: string | null;
}

/** A single stateless reasoning turn. */
export interface HarnessInvocation {
  /** The fully assembled prompt — Hermes owns all context. */
  prompt: string;
  /** Hard deadline; the subprocess is killed if exceeded. */
  timeoutMs?: number;
  /** Cancellation, wired to the UI abort button. */
  signal?: AbortSignal;
}

/**
 * The normalized result of a harness invocation. The `HermesResponse` is
 * extracted from `text` by the response parser (a later build step); provider
 * quirks live in `providerMeta` so the orchestrator never branches on provider.
 */
export interface HarnessResult {
  /** The model's response text — the channel the structured block rides in. */
  text: string;
  /** Wall-clock duration of the invocation. */
  durationMs: number;
  /** Provider-specific detail (cost, token usage, stop reason) — telemetry
   *  only; the orchestrator must not depend on its shape. */
  providerMeta?: Record<string, unknown>;
}

/** The result of probing whether a provider's CLI is present and responding. */
export interface ProviderAvailability {
  available: boolean;
  version?: string;
  reason?: string;
}

/** The contract every harness provider conforms to. */
export interface HarnessProvider {
  readonly profile: ProviderProfile;
  /** Run one stateless reasoning turn. */
  invoke(invocation: HarnessInvocation): Promise<HarnessResult>;
  /** Probe that the CLI is present and responding — used by the doctor gate. */
  checkAvailability(): Promise<ProviderAvailability>;
}
