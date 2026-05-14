import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  isManifestStale,
  parseSkillFile,
  SkillManifest,
  toCapabilityTable,
  type CapabilityTable,
  type FileStamp,
  type ManifestEntry,
  type ParsedSkill,
} from '@cloud-hermes/core';

/**
 * The skill catalog loader.
 *
 * Reads skill files from one or more roots, validates them, derives the safety
 * guard's capability tables from their frontmatter, and keeps the manifest on
 * disk honest — rebuilding it when it is missing or stale against the files.
 *
 * The loader takes a *list* of roots so a per-workspace custom-skill directory
 * is a later config change, not a refactor; v1 passes a single built-in root.
 * A skill whose frontmatter does not validate is excluded and recorded as an
 * error — fail closed, never load a malformed capability table.
 */

export interface SkillCatalog {
  /** Successfully parsed skills, keyed by id. */
  skills: Map<string, ParsedSkill>;
  /** The compact index — rebuilt on disk if it was stale or missing. */
  manifest: SkillManifest;
  /** Capability tables for the safety guard, derived from skill frontmatter. */
  capabilityTables: CapabilityTable[];
  /** Terraform templates, keyed by file name. */
  templates: Map<string, string>;
  /** Files that failed to load — surfaced, never swallowed. */
  errors: { path: string; error: string }[];
}

const SERVICES_SUBDIR = 'services';
const TEMPLATES_SUBDIR = 'templates';
const MANIFEST_FILENAME = 'manifest.json';

async function readManifest(path: string): Promise<SkillManifest | null> {
  try {
    const parsed = SkillManifest.safeParse(JSON.parse(await readFile(path, 'utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function loadTemplates(root: string): Promise<Map<string, string>> {
  const templates = new Map<string, string>();
  const templatesDir = join(root, TEMPLATES_SUBDIR);
  let files: string[];
  try {
    files = (await readdir(templatesDir)).filter((name) => name.endsWith('.tmpl'));
  } catch {
    return templates;
  }
  for (const file of files) {
    try {
      templates.set(file, await readFile(join(templatesDir, file), 'utf8'));
    } catch {
      // a missing template surfaces later as an unresolved Terraform path
    }
  }
  return templates;
}

export async function loadSkillCatalog(roots: readonly string[]): Promise<SkillCatalog> {
  const skills = new Map<string, ParsedSkill>();
  const capabilityTables: CapabilityTable[] = [];
  const templates = new Map<string, string>();
  const errors: { path: string; error: string }[] = [];
  const entries: ManifestEntry[] = [];
  const stamps: FileStamp[] = [];

  for (const root of roots) {
    for (const [name, content] of await loadTemplates(root)) {
      templates.set(name, content);
    }

    const servicesDir = join(root, SERVICES_SUBDIR);
    let files: string[];
    try {
      files = (await readdir(servicesDir)).filter((name) => name.endsWith('.md')).sort();
    } catch {
      errors.push({ path: servicesDir, error: 'skills directory could not be read' });
      continue;
    }

    for (const file of files) {
      const filePath = join(servicesDir, file);
      const relPath = relative(root, filePath);
      const result = parseSkillFile(await readFile(filePath, 'utf8'));

      if (!result.ok) {
        errors.push({ path: relPath, error: result.error });
        continue;
      }

      const { frontmatter } = result.skill;
      if (skills.has(frontmatter.id)) {
        errors.push({ path: relPath, error: `duplicate skill id "${frontmatter.id}"` });
        continue;
      }

      skills.set(frontmatter.id, result.skill);
      capabilityTables.push(toCapabilityTable(frontmatter));

      const stats = await stat(filePath);
      entries.push({
        id: frontmatter.id,
        displayName: frontmatter.displayName,
        description: frontmatter.description,
        service: frontmatter.service,
        dependsOn: frontmatter.dependsOn,
        path: relPath,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      });
      stamps.push({ path: relPath, mtimeMs: stats.mtimeMs, size: stats.size });
    }
  }

  const manifest: SkillManifest = { builtAt: new Date().toISOString(), entries };

  // Keep manifest.json in the first root honest against the files on disk.
  const primaryRoot = roots[0];
  if (primaryRoot !== undefined) {
    const manifestPath = join(primaryRoot, MANIFEST_FILENAME);
    const existing = await readManifest(manifestPath);
    if (existing === null || isManifestStale(existing, stamps)) {
      try {
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      } catch {
        // A read-only skills directory is not fatal — the in-memory manifest
        // is authoritative for this run.
      }
    }
  }

  return { skills, manifest, capabilityTables, templates, errors };
}
