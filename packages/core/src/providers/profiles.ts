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
 * Gemini CLI. `-p` is the non-interactive headless trigger; its value is
 * appended to stdin, so it is passed empty (`-p ""`) with the real prompt
 * delivered on stdin. `--output-format json` wraps the response in an
 * envelope. (`--approval-mode plan`, the read-only mode, is intentionally not
 * used: it requires an experimental flag to be enabled. The CLI is kept from
 * acting by the system framing and by having no reason to call a tool.)
 */
export const GEMINI_PROFILE: ProviderProfile = {
  id: 'gemini',
  displayName: 'Gemini CLI',
  bin: 'gemini',
  baseArgs: ['--output-format', 'json', '-p', ''],
  versionArgs: ['--version'],
  envelope: 'gemini-json',
  versionMin: null,
};

export const PROVIDER_PROFILES: Record<ProviderId, ProviderProfile> = {
  claude: CLAUDE_PROFILE,
  gemini: GEMINI_PROFILE,
};
