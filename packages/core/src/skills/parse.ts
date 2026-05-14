import { parse as parseYaml } from 'yaml';
import { SkillFrontmatter } from './schema';
import type { Capability, CapabilityTable } from '../safety/types';

/**
 * Skill file parsing.
 *
 * Pure: text in, a validated skill or an error out. A skill whose frontmatter
 * does not pass the schema is rejected outright — fail closed, never load a
 * malformed capability table, because a permissive table is a hole in the
 * safety guard.
 */

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  /** The markdown body, fed to the reasoning CLI when the skill is loaded. */
  body: string;
}

export type SkillParseResult =
  | { ok: true; skill: ParsedSkill }
  | { ok: false; error: string };

/** Splits a skill file's leading `---` YAML frontmatter from its markdown body. */
function splitFrontmatter(text: string): { yaml: string; body: string } | null {
  const unified = text.split('\r\n').join('\n');
  if (!unified.startsWith('---\n')) return null;

  const closing = unified.indexOf('\n---', 4);
  if (closing === -1) return null;

  const yaml = unified.slice(4, closing);
  const afterClosing = unified.indexOf('\n', closing + 4);
  const body = afterClosing === -1 ? '' : unified.slice(afterClosing + 1);
  return { yaml, body };
}

export function parseSkillFile(text: string): SkillParseResult {
  const split = splitFrontmatter(text);
  if (split === null) {
    return { ok: false, error: 'missing or malformed YAML frontmatter' };
  }

  let raw: unknown;
  try {
    raw = parseYaml(split.yaml);
  } catch (err) {
    return {
      ok: false,
      error: `frontmatter is not valid YAML: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const result = SkillFrontmatter.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: `frontmatter failed validation: ${result.error.message}` };
  }

  return { ok: true, skill: { frontmatter: result.data, body: split.body.trim() } };
}

/**
 * Derives the safety guard's `CapabilityTable` from a skill's frontmatter. The
 * frontmatter capability block is the single source — this is the only place
 * it crosses into the guard's vocabulary, and no second copy of the allowed
 * verbs exists anywhere else.
 */
export function toCapabilityTable(frontmatter: SkillFrontmatter): CapabilityTable {
  return {
    skillId: frontmatter.id,
    capabilities: frontmatter.capabilities.map(
      (capability): Capability => ({
        service: frontmatter.service,
        resourceType: capability.resourceType,
        verb: capability.verb,
        classification: capability.classification,
        flagDenylist: capability.flagDenylist,
      }),
    ),
  };
}
