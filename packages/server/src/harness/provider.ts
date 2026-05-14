import {
  PROVIDER_PROFILES,
  HermesError,
  type HarnessInvocation,
  type HarnessProvider,
  type HarnessResult,
  type ProviderAvailability,
  type ProviderId,
  type ProviderProfile,
} from '@cloud-hermes/core';
import { DEFAULT_ENV_ALLOWLIST, runSubprocess } from './spawn';
import { parseEnvelope } from './envelope';

const DEFAULT_INVOKE_TIMEOUT_MS = 120_000;
const AVAILABILITY_TIMEOUT_MS = 10_000;

/**
 * Per-provider additions to the environment allowlist — the credential and
 * config variables each CLI legitimately needs, and nothing more. The base
 * allowlist plus this is the entire environment the subprocess sees.
 */
const PROVIDER_ENV_EXTRA: Record<ProviderId, readonly string[]> = {
  claude: [
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_AUTH_TOKEN',
    'ANTHROPIC_BASE_URL',
    'CLAUDE_CONFIG_DIR',
    'XDG_CONFIG_HOME',
  ],
  gemini: [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'GOOGLE_GENAI_USE_VERTEXAI',
    'GOOGLE_CLOUD_PROJECT',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'XDG_CONFIG_HOME',
  ],
};

export interface HarnessProviderOptions {
  /** Working directory for the subprocess. */
  cwd?: string;
}

/**
 * Builds a {@link HarnessProvider} from a declarative profile.
 *
 * There is one spawn/parse engine; a provider is its profile plus a credential
 * allowlist. Adding a provider is adding a profile, not code — and the rest of
 * Hermes only ever sees the `HarnessProvider` interface.
 */
export function createHarnessProvider(
  profile: ProviderProfile,
  options: HarnessProviderOptions = {},
): HarnessProvider {
  const cwd = options.cwd ?? process.cwd();
  const envAllowlist = [...DEFAULT_ENV_ALLOWLIST, ...PROVIDER_ENV_EXTRA[profile.id]];

  return {
    profile,

    async invoke(invocation: HarnessInvocation): Promise<HarnessResult> {
      const result = await runSubprocess({
        bin: profile.bin,
        args: profile.baseArgs,
        stdin: invocation.prompt,
        cwd,
        envAllowlist,
        timeoutMs: invocation.timeoutMs ?? DEFAULT_INVOKE_TIMEOUT_MS,
        signal: invocation.signal,
      });

      if (result.aborted) {
        throw new HermesError(
          'timeout',
          `${profile.displayName} was cancelled.`,
          result.stderrTail,
        );
      }
      if (result.timedOut) {
        throw new HermesError(
          'timeout',
          `${profile.displayName} did not respond within the time limit.`,
          result.stderrTail,
        );
      }
      if (result.exitCode !== 0) {
        throw new HermesError(
          'non-zero-exit',
          `${profile.displayName} exited with code ${result.exitCode ?? 'unknown'}.`,
          result.stderrTail,
        );
      }

      const parsed = parseEnvelope(profile.envelope, result.stdout);
      return {
        text: parsed.text,
        durationMs: result.durationMs,
        providerMeta: parsed.providerMeta,
      };
    },

    async checkAvailability(): Promise<ProviderAvailability> {
      try {
        const result = await runSubprocess({
          bin: profile.bin,
          args: profile.versionArgs,
          cwd,
          envAllowlist,
          timeoutMs: AVAILABILITY_TIMEOUT_MS,
        });
        if (result.exitCode !== 0) {
          return {
            available: false,
            reason: result.stderrTail || `exited with code ${result.exitCode ?? 'unknown'}`,
          };
        }
        return {
          available: true,
          version: result.stdout.trim().split('\n')[0] ?? '',
        };
      } catch (err) {
        return {
          available: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

/** Convenience: build a provider by id from the built-in profiles. */
export function createProviderById(
  id: ProviderId,
  options?: HarnessProviderOptions,
): HarnessProvider {
  return createHarnessProvider(PROVIDER_PROFILES[id], options);
}
