import type { SkillCapability } from './schema';

/**
 * Parameter validation and template interpolation.
 *
 * The reasoning CLI never writes a command string — it fills declared param
 * slots, and Hermes interpolates the vetted template. This is where that
 * happens, and it is deliberately strict:
 *
 *  - every required param must be present and must satisfy its constraint
 *    (a `pattern` it must fully match, or a `oneOf` set it must belong to);
 *  - the gcloud template is split into argv tokens *before* interpolation —
 *    the template is authored clean, so the split is safe — and each value is
 *    substituted *into* a token, so a value can never become a new argument;
 *  - an unfilled or unknown slot is a loud error, never a silent empty string.
 *
 * The interpolated argv is still re-run through the full classifier by the
 * caller — interpolation is never trusted to have preserved the template's
 * safety properties.
 */

export type InterpolateResult =
  | { ok: true; argv: string[] }
  | { ok: false; error: string };

/** Validates the params against a capability's declared constraints. */
export function validateParams(
  capability: SkillCapability,
  params: Record<string, string>,
): { ok: true } | { ok: false; error: string } {
  for (const param of capability.requiredParams) {
    const value = params[param.name];
    if (value === undefined || value === '') {
      return { ok: false, error: `missing required parameter "${param.name}"` };
    }
    if (param.pattern !== undefined) {
      let pattern: RegExp;
      try {
        pattern = new RegExp(param.pattern);
      } catch {
        return { ok: false, error: `parameter "${param.name}" has an invalid pattern` };
      }
      if (!pattern.test(value)) {
        return {
          ok: false,
          error: `parameter "${param.name}" does not match its required pattern`,
        };
      }
    }
    if (param.oneOf !== undefined && !param.oneOf.includes(value)) {
      return {
        ok: false,
        error: `parameter "${param.name}" must be one of: ${param.oneOf.join(', ')}`,
      };
    }
  }
  return { ok: true };
}

/** Substitutes `{slot}` references in a single token. Returns null when a slot
 *  is malformed or names a param that was not provided. */
function fillSlots(token: string, params: Record<string, string>): string | null {
  let result = '';
  let index = 0;
  while (index < token.length) {
    if (token[index] === '{') {
      const close = token.indexOf('}', index);
      if (close === -1) return null;
      const name = token.slice(index + 1, close);
      const value = params[name];
      if (value === undefined) return null;
      result += value;
      index = close + 1;
    } else {
      result += token[index];
      index += 1;
    }
  }
  return result;
}

/**
 * Interpolates a capability's gcloud template into an argv array. Validates the
 * params first; splits the template into tokens before substituting, so a
 * value can never split into a new argument.
 */
export function interpolateGcloud(
  capability: SkillCapability,
  params: Record<string, string>,
): InterpolateResult {
  const validation = validateParams(capability, params);
  if (!validation.ok) return validation;

  const tokens = capability.gcloudTemplate.split(' ').filter((token) => token !== '');
  const argv: string[] = [];
  for (const token of tokens) {
    const interpolated = fillSlots(token, params);
    if (interpolated === null) {
      return { ok: false, error: `template token "${token}" referenced an unprovided parameter` };
    }
    argv.push(interpolated);
  }
  return { ok: true, argv };
}

/**
 * Interpolates a Terraform template. Known slots are filled; any slot without
 * a param is left in place and reported in `unresolved`, so a templating bug
 * is visible rather than silently producing a wrong value.
 */
export function interpolateTerraform(
  template: string,
  params: Record<string, string>,
): { hcl: string; unresolved: string[] } {
  const unresolved = new Set<string>();
  const hcl = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match: string, name: string) => {
    const value = params[name];
    if (value === undefined) {
      unresolved.add(name);
      return match;
    }
    return value;
  });
  return { hcl, unresolved: [...unresolved].sort() };
}
