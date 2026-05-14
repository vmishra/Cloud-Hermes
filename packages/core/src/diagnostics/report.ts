/**
 * The environment report.
 *
 * Diagnose mode reasons about an error against the operator's *actual*
 * environment — what is installed, the gcloud auth state, the configured
 * project, the workspace. That grounding is what lets the guidance be
 * customized rather than generic: when the harness suggests a command, it fills
 * in the real project id and account because they are right here in the report.
 *
 * The type and the renderer are pure and live in core; the gathering (which
 * shells out) lives in the server.
 */

export interface HarnessReport {
  id: string;
  installed: boolean;
  version: string | null;
}

export interface EnvironmentReport {
  /** `process.platform` — `linux`, `darwin`, `win32`. */
  platform: string;
  nodeVersion: string;
  gcloud: {
    installed: boolean;
    version: string | null;
    /** The active authenticated account, or null. */
    account: string | null;
    /** Whether Application Default Credentials are available. */
    adc: boolean;
    /** The currently-configured project, or null. */
    project: string | null;
  };
  terraform: { installed: boolean; version: string | null };
  harnesses: HarnessReport[];
  /** The workspace the diagnosis is running in, or null during onboarding. */
  workspace: {
    name: string;
    projectId: string;
    /** ISO timestamp of the last sync, or null if never synced. */
    syncedAt: string | null;
    /** Sync slices that could not be read — often the real cause of a problem. */
    unavailableSlices: string[];
  } | null;
}

const yesNo = (value: boolean): string => (value ? 'yes' : 'no');

/** Renders the report as a compact, deterministic text block for the prompt. */
export function renderEnvironmentReport(report: EnvironmentReport): string {
  const lines: string[] = ['Environment report — use these real values in any command you give:'];
  lines.push(`  platform: ${report.platform}`);
  lines.push(`  node: ${report.nodeVersion}`);

  if (report.gcloud.installed) {
    lines.push(
      `  gcloud: installed${report.gcloud.version ? ` (${report.gcloud.version})` : ''}` +
        ` — account: ${report.gcloud.account ?? 'none'}` +
        `, ADC: ${yesNo(report.gcloud.adc)}` +
        `, configured project: ${report.gcloud.project ?? 'unset'}`,
    );
  } else {
    lines.push('  gcloud: not installed');
  }

  lines.push(
    `  terraform: ${
      report.terraform.installed
        ? `installed${report.terraform.version ? ` (${report.terraform.version})` : ''}`
        : 'not installed'
    }`,
  );

  const harnesses = [...report.harnesses]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (harness) =>
        `${harness.id}: ${
          harness.installed
            ? `installed${harness.version ? ` (${harness.version})` : ''}`
            : 'not installed'
        }`,
    );
  lines.push(`  harness — ${harnesses.join(', ')}`);

  if (report.workspace !== null) {
    const slices =
      report.workspace.unavailableSlices.length > 0
        ? ` — unavailable slices: ${[...report.workspace.unavailableSlices].sort().join(', ')}`
        : '';
    lines.push(
      `  workspace: "${report.workspace.name}" — project ${report.workspace.projectId}` +
        `, last synced ${report.workspace.syncedAt ?? 'never'}${slices}`,
    );
  } else {
    lines.push('  workspace: none yet (the operator is still onboarding)');
  }

  return lines.join('\n');
}
