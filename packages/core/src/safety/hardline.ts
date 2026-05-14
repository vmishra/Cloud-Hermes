/**
 * The HARDLINE floor.
 *
 * The verdict gate that does not bend. A destructive verb is BLOCKED
 * unconditionally — no skill capability table, no policy file, and no future
 * auto-run mode can lift it. It is checked before any allowlist, so the safety
 * floor is code, not data. This is what makes "destructive operations are
 * structurally unreachable" actually true.
 */

/** Verbs that are destructive on their own. */
const HARDLINE_EXACT_VERBS = new Set<string>(['delete', 'destroy', 'purge', 'remove']);

/**
 * Verb prefixes that introduce destructive operations — `delete-access-config`,
 * `remove-iam-policy-binding`, `abandon-instances`, `detach-disk`, and the
 * like. Matched against the start of a token, never as a substring.
 */
const HARDLINE_VERB_PREFIXES = [
  'delete-',
  'destroy-',
  'remove-',
  'abandon-',
  'detach-',
  'clear-',
];

/**
 * Returns true if a token is a destructive verb. Tokens must already be
 * normalized — see {@link normalizeToken}.
 */
export function isHardlineVerb(token: string): boolean {
  const lower = token.toLowerCase();
  if (HARDLINE_EXACT_VERBS.has(lower)) return true;
  return HARDLINE_VERB_PREFIXES.some((prefix) => lower.startsWith(prefix));
}
