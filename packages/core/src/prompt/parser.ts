import { HermesResponse } from '../schemas/hermes';

/**
 * The response parser.
 *
 * The reasoning CLI is expected to emit prose plus one fenced ```json block.
 * Model output is unreliable enough that a single re-ask is not sufficient on
 * its own — so this is a deterministic salvage path that runs *before* the
 * orchestrator spends a re-ask round:
 *
 *   1. extract the fenced ```json block, parse, validate against HermesResponse;
 *   2. if that misses, scan for the first balanced {...} object and try again;
 *   3. only if both fail does the caller fall back to the structured re-ask.
 *
 * Pure and unit-tested — no I/O, no provider calls.
 */

export type ParseError = 'no-json' | 'invalid-json' | 'schema-invalid';

export type ParseOutcome =
  | { ok: true; response: HermesResponse; salvaged: boolean }
  | { ok: false; error: ParseError; detail: string };

/** Returns the trimmed contents of the first ```json fenced block, or null. */
export function extractFencedJson(text: string): string | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  const body = match?.[1];
  return body === undefined ? null : body.trim();
}

/** Scans for a balanced `{...}` object starting at `start`, ignoring braces
 *  inside JSON strings. Returns the object substring, or null if it never
 *  balances (e.g. the candidate `{` was an unterminated stray brace). */
function scanBalanced(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Returns the first balanced `{...}` object in the text. Each `{` is tried as a
 * candidate start, so a stray unterminated brace — say, from a malformed fenced
 * block — does not prevent finding the real object that follows it. Braces
 * inside JSON strings are ignored.
 */
export function extractBalancedJson(text: string): string | null {
  for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
    const candidate = scanBalanced(text, start);
    if (candidate !== null) return candidate;
  }
  return null;
}

function validate(jsonText: string, salvaged: boolean): ParseOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'invalid-json', detail: jsonText.slice(0, 500) };
  }
  const result = HermesResponse.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: 'schema-invalid', detail: result.error.message };
  }
  return { ok: true, response: result.data, salvaged };
}

/**
 * Extracts and validates the HermesResponse from a harness reply, salvaging a
 * bare balanced object when the fence is missing or malformed.
 */
export function parseHermesResponse(text: string): ParseOutcome {
  const fenced = extractFencedJson(text);
  if (fenced !== null) {
    const outcome = validate(fenced, false);
    if (outcome.ok) return outcome;
  }

  const balanced = extractBalancedJson(text);
  if (balanced !== null) {
    // Skip a pointless re-validation when salvage found the exact same text.
    if (balanced !== fenced) {
      const outcome = validate(balanced, true);
      if (outcome.ok) return outcome;
      return outcome;
    }
  }

  if (fenced !== null) {
    // A fenced block was present but neither it nor salvage validated.
    return validate(fenced, false);
  }
  return { ok: false, error: 'no-json', detail: text.slice(0, 500) };
}
