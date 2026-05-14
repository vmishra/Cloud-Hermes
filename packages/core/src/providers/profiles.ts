import type { ProviderId, ProviderProfile } from './types';

/**
 * The declarative provider profiles. Every CLI-specific flag and assumption
 * lives here — the spawn engine and the rest of Hermes are provider-agnostic.
 */

/**
 * Claude Code. `-p` is non-interactive print mode; `--tools ""` disables every
 * tool (the CLI is a pure reasoning function); `--no-session-persistence`
 * keeps it stateless; `--output-format json` wraps the response in an envelope.
 * `--tools` is variadic, so it is placed last with nothing after it to absorb.
 */
export const CLAUDE_PROFILE: ProviderProfile = {
  id: 'claude',
  displayName: 'Claude Code',
  bin: 'claude',
  baseArgs: ['-p', '--output-format', 'json', '--no-session-persistence', '--tools', ''],
  versionArgs: ['--version'],
  envelope: 'claude-json',
  versionMin: null,
};

/**
 * Gemini CLI. `-p` is non-interactive headless mode; `--approval-mode plan` is
 * its read-only mode — the closest available equivalent to disabling tools;
 * `--output-format json` wraps the response in an envelope.
 */
export const GEMINI_PROFILE: ProviderProfile = {
  id: 'gemini',
  displayName: 'Gemini CLI',
  bin: 'gemini',
  baseArgs: ['-p', '--output-format', 'json', '--approval-mode', 'plan'],
  versionArgs: ['--version'],
  envelope: 'gemini-json',
  versionMin: null,
};

export const PROVIDER_PROFILES: Record<ProviderId, ProviderProfile> = {
  claude: CLAUDE_PROFILE,
  gemini: GEMINI_PROFILE,
};
