import {
  PROVIDER_PROFILES,
  type EnvironmentReport,
  type HarnessReport,
  type ProviderId,
} from '@cloud-hermes/core';
import { createHarnessProvider } from '../harness/index';
import { runSubprocess } from '../harness/spawn';
import { checkAuthStatus } from '../onboarding/index';

/**
 * Gathers the environment report — the real, current state of the operator's
 * machine and project that diagnose mode reasons against. The report's type and
 * its renderer are pure and live in core; the gathering shells out, so it lives
 * here.
 */

/** The workspace context for a report, when a diagnosis runs inside a workspace. */
export interface WorkspaceContext {
  name: string;
  projectId: string;
  syncedAt: string | null;
  unavailableSlices: string[];
}

const firstLine = (text: string): string => text.split('\n')[0]?.trim() ?? '';

async function probeVersion(bin: string, args: string[]): Promise<string | null> {
  try {
    const result = await runSubprocess({ bin, args, cwd: process.cwd(), timeoutMs: 10_000 });
    return result.exitCode === 0 ? firstLine(result.stdout || result.stderrTail) : null;
  } catch {
    return null;
  }
}

export async function gatherEnvironmentReport(
  workspace: WorkspaceContext | null = null,
): Promise<EnvironmentReport> {
  const [gcloud, gcloudVersion, terraformVersion] = await Promise.all([
    checkAuthStatus(),
    probeVersion('gcloud', ['--version']),
    probeVersion('terraform', ['--version']),
  ]);

  const harnesses: HarnessReport[] = [];
  for (const id of Object.keys(PROVIDER_PROFILES) as ProviderId[]) {
    const availability = await createHarnessProvider(PROVIDER_PROFILES[id]).checkAvailability();
    harnesses.push({
      id,
      installed: availability.available,
      version: availability.version ?? null,
    });
  }

  return {
    platform: process.platform,
    nodeVersion: process.version,
    gcloud: {
      installed: gcloud.installed,
      version: gcloudVersion,
      account: gcloud.account,
      adc: gcloud.adc,
      project: gcloud.project,
    },
    terraform: { installed: terraformVersion !== null, version: terraformVersion },
    harnesses,
    workspace,
  };
}
