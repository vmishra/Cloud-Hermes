import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Loads the troubleshooting knowledge base — a markdown document of common
 * setup and runtime errors and their remediation, shipped alongside the skill
 * catalog. It is reference knowledge for diagnose mode, not a skill: it has no
 * capability table and never reaches the safety guard.
 */
export async function loadTroubleshootingKnowledge(skillsDir: string): Promise<string> {
  try {
    return await readFile(join(skillsDir, 'troubleshooting', 'common-errors.md'), 'utf8');
  } catch {
    return '';
  }
}
