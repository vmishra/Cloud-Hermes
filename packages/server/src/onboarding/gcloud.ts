import type { GcloudStatus } from '@cloud-hermes/core';
import { runGcloud } from '../gcp/index';

/**
 * gcloud onboarding helpers.
 *
 * Cloud Hermes detects the state of the gcloud CLI rather than driving its
 * interactive auth flow: onboarding checks whether gcloud is installed,
 * whether an account and Application Default Credentials are present, and what
 * project is configured — and where something is missing, the UI guides the
 * operator through it. These are config and auth plumbing, not infrastructure
 * mutations, so they run directly rather than through the safety classifier.
 */

/** GCP project ids: a leading letter, then lowercase letters, digits, and
 *  hyphens, 6–30 characters total. */
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

export function isValidProjectId(id: string): boolean {
  return PROJECT_ID_PATTERN.test(id);
}

export interface GcloudProject {
  projectId: string;
  name: string;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Extracts the active account from `gcloud auth list --format=json` output. */
export function parseAuthList(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && 'status' in entry && 'account' in entry) {
      const record = entry as { status: unknown; account: unknown };
      if (record.status === 'ACTIVE' && typeof record.account === 'string') {
        return record.account;
      }
    }
  }
  return null;
}

/** Extracts projects from `gcloud projects list --format=json` output. */
export function parseProjectList(raw: unknown): GcloudProject[] {
  if (!Array.isArray(raw)) return [];
  const projects: GcloudProject[] = [];
  for (const entry of raw) {
    if (entry && typeof entry === 'object' && 'projectId' in entry) {
      const record = entry as { projectId: unknown; name?: unknown };
      if (typeof record.projectId === 'string') {
        projects.push({
          projectId: record.projectId,
          name: typeof record.name === 'string' ? record.name : record.projectId,
        });
      }
    }
  }
  return projects;
}

export async function checkGcloudInstalled(): Promise<boolean> {
  try {
    const result = await runGcloud(['--version'], { timeoutMs: 10_000 });
    return result.ok;
  } catch {
    return false;
  }
}

/**
 * Returns a fresh Application Default Credentials access token, or null if one
 * cannot be obtained. ADC tokens are short-lived (about an hour), so callers
 * fetch one per discrete operation rather than caching it.
 */
export async function getAdcToken(): Promise<string | null> {
  try {
    const result = await runGcloud(['auth', 'application-default', 'print-access-token'], {
      timeoutMs: 20_000,
    });
    const token = result.stdout.trim();
    return result.ok && token !== '' ? token : null;
  } catch {
    return null;
  }
}

/** A full read of the gcloud CLI's auth and project state. */
export async function checkAuthStatus(): Promise<GcloudStatus> {
  if (!(await checkGcloudInstalled())) {
    return { installed: false, account: null, adc: false, project: null };
  }

  let account: string | null = null;
  try {
    const result = await runGcloud(['auth', 'list', '--format=json'], { timeoutMs: 15_000 });
    if (result.ok) account = parseAuthList(safeJson(result.stdout));
  } catch {
    // leave account null
  }

  let adc = false;
  try {
    const result = await runGcloud(['auth', 'application-default', 'print-access-token'], {
      timeoutMs: 20_000,
    });
    adc = result.ok && result.stdout.trim().length > 0;
  } catch {
    // leave adc false
  }

  let project: string | null = null;
  try {
    const result = await runGcloud(['config', 'get-value', 'project'], { timeoutMs: 10_000 });
    const value = result.stdout.trim();
    project = result.ok && value !== '' && value !== '(unset)' ? value : null;
  } catch {
    // leave project null
  }

  return { installed: true, account, adc, project };
}

export async function listProjects(): Promise<GcloudProject[]> {
  try {
    const result = await runGcloud(['projects', 'list', '--format=json'], { timeoutMs: 30_000 });
    return result.ok ? parseProjectList(safeJson(result.stdout)) : [];
  } catch {
    return [];
  }
}

export async function setProject(projectId: string): Promise<boolean> {
  if (!isValidProjectId(projectId)) return false;
  try {
    const result = await runGcloud(['config', 'set', 'project', projectId], { timeoutMs: 15_000 });
    return result.ok;
  } catch {
    return false;
  }
}
