import type { ParsedSkill, PlanStep, SkillCapability } from '@cloud-hermes/core';
import type { SkillCatalog } from '../skills/index';

/**
 * Resolves a plan step to its skill and capability.
 *
 * A plan step names a skill and a capability — either `resourceType:verb`, or a
 * bare verb when it is unambiguous within the skill. This finds the declared
 * capability, or reports precisely why it could not: an unknown skill, a
 * capability the skill does not declare, or an ambiguous bare verb. A step that
 * does not resolve never reaches interpolation.
 */

export type ResolvedStep =
  | { ok: true; skill: ParsedSkill; capability: SkillCapability }
  | { ok: false; error: string };

export function resolvePlanStep(step: PlanStep, catalog: SkillCatalog): ResolvedStep {
  const skill = catalog.skills.get(step.skillId);
  if (skill === undefined) {
    return { ok: false, error: `unknown skill "${step.skillId}"` };
  }

  const lastColon = step.capability.lastIndexOf(':');
  let candidates: SkillCapability[];
  if (lastColon === -1) {
    const verb = step.capability.trim();
    candidates = skill.frontmatter.capabilities.filter((entry) => entry.verb === verb);
  } else {
    const resourceType = step.capability.slice(0, lastColon).trim();
    const verb = step.capability.slice(lastColon + 1).trim();
    candidates = skill.frontmatter.capabilities.filter(
      (entry) => entry.resourceType === resourceType && entry.verb === verb,
    );
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: `skill "${step.skillId}" does not declare the capability "${step.capability}"`,
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      error: `capability "${step.capability}" is ambiguous in skill "${step.skillId}" — name it as resourceType:verb`,
    };
  }

  return { ok: true, skill, capability: candidates[0]! };
}
