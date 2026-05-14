/**
 * Token normalization.
 *
 * Every argv token is normalized before any matching happens, so obfuscation
 * cannot slip a destructive verb past the allowlist: NFKC folds fullwidth and
 * compatibility characters down to their plain forms, and zero-width and null
 * characters are stripped outright.
 */

/**
 * Code points stripped from every token: null (0x00), the zero-width family
 * (0x200B zero-width space, 0x200C/0x200D joiners), the word joiner (0x2060),
 * and the byte-order mark (0xFEFF). They carry no meaning here but can break
 * naive string matching.
 */
const INVISIBLE_CODE_POINTS = new Set<number>([
  0x00, 0x200b, 0x200c, 0x200d, 0x2060, 0xfeff,
]);

/** Normalizes a single token: NFKC fold, strip invisibles, trim. */
export function normalizeToken(token: string): string {
  const folded = token.normalize('NFKC');
  let out = '';
  for (const char of folded) {
    if (!INVISIBLE_CODE_POINTS.has(char.codePointAt(0) ?? -1)) out += char;
  }
  return out.trim();
}

/** Normalizes every token in an argv array. */
export function normalizeArgv(argv: readonly string[]): string[] {
  return argv.map(normalizeToken);
}
