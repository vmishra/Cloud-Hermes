import { renderManifestIndex, type ParsedSkill } from '@cloud-hermes/core';
import type { SkillCatalog } from './loader';

/**
 * Skill resolution for progressive loading.
 *
 * The reasoning CLI sees the compact manifest index and requests skills by id.
 * Hermes resolves each request to include its dependency closure — a request
 * for `compute-vm` pulls in `subnet` and `vpc` too — and folds the full skill
 * bodies into the prompt's skills section.
 */

/** Expands a set of skill ids to include their transitive `dependsOn` closure.
 *  An unknown id is ignored rather than fatal — it simply contributes nothing. */
export function resolveSkillClosure(catalog: SkillCatalog, ids: Iterable<string>): string[] {
  const closure = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (closure.has(id)) continue;
    const skill = catalog.skills.get(id);
    if (skill === undefined) continue;
    closure.add(id);
    for (const dependency of skill.frontmatter.dependsOn) {
      if (!closure.has(dependency)) queue.push(dependency);
    }
  }
  return [...closure].sort();
}

/**
 * Builds the prompt's skills section: the manifest index, plus the full bodies
 * of the requested skills and their dependency closure.
 */
export function buildSkillsSection(catalog: SkillCatalog, requestedIds: Iterable<string>): string {
  const index = renderManifestIndex(catalog.manifest);
  const closure = resolveSkillClosure(catalog, requestedIds);
  if (closure.length === 0) return index;

  const bodies = closure
    .map((id) => catalog.skills.get(id))
    .filter((skill): skill is ParsedSkill => skill !== undefined)
    .map((skill) => `## Skill: ${skill.frontmatter.id} — ${skill.frontmatter.displayName}\n\n${skill.body}`);

  return `${index}\n\nLoaded skill detail:\n\n${bodies.join('\n\n')}`;
}
