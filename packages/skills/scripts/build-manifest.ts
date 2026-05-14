/**
 * Builds the skill manifest.
 *
 * Run with `npm run build` in this package. Parses every skill file, and writes
 * the compact index to `manifest.json`. A skill whose frontmatter does not
 * validate is excluded and the build exits non-zero — fail the build, not open:
 * a malformed capability table must never become a permissive one.
 *
 * The server also rebuilds the manifest on boot when it is stale, so this
 * script is for building the catalog standalone.
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseSkillFile, type ManifestEntry, type SkillManifest } from '@cloud-hermes/core';

const SKILLS_ROOT = join(import.meta.dirname, '..');
const SERVICES_DIR = join(SKILLS_ROOT, 'services');
const MANIFEST_PATH = join(SKILLS_ROOT, 'manifest.json');

async function main(): Promise<void> {
  process.stdout.write('\nBuilding the Cloud Hermes skill manifest\n\n');

  const files = (await readdir(SERVICES_DIR)).filter((name) => name.endsWith('.md')).sort();
  const entries: ManifestEntry[] = [];
  const seenIds = new Set<string>();
  let failed = false;

  for (const file of files) {
    const path = join(SERVICES_DIR, file);
    const result = parseSkillFile(await readFile(path, 'utf8'));

    if (!result.ok) {
      process.stdout.write(`  [invalid] ${file} — ${result.error}\n`);
      failed = true;
      continue;
    }

    const { frontmatter } = result.skill;
    if (seenIds.has(frontmatter.id)) {
      process.stdout.write(`  [invalid] ${file} — duplicate skill id "${frontmatter.id}"\n`);
      failed = true;
      continue;
    }
    seenIds.add(frontmatter.id);

    const stats = await stat(path);
    entries.push({
      id: frontmatter.id,
      displayName: frontmatter.displayName,
      description: frontmatter.description,
      service: frontmatter.service,
      dependsOn: frontmatter.dependsOn,
      path: relative(SKILLS_ROOT, path),
      mtimeMs: stats.mtimeMs,
      size: stats.size,
    });
    process.stdout.write(`  [ok]      ${file} — ${frontmatter.id}\n`);
  }

  if (failed) {
    process.stdout.write('\n  Build failed — a skill did not validate. Fix it and rerun.\n\n');
    process.exit(1);
  }

  const manifest: SkillManifest = { builtAt: new Date().toISOString(), entries };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`\n  Wrote ${entries.length} skill(s) to manifest.json\n\n`);
}

void main();
