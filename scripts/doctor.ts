/**
 * Cloud Hermes — environment preflight.
 *
 * Run with `npm run doctor`. Detects the tooling Cloud Hermes depends on and
 * prints actionable guidance for anything missing.
 *
 * The gate is binary: the app needs Node and at least one reasoning harness
 * (Claude Code or Gemini) to start. `gcloud` and `terraform` are checked here
 * but are exercised at runtime — onboarding guides the user through them — so
 * their absence is a warning, not a failure.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

type Tool = {
  name: string;
  bin: string;
  versionArgs: string[];
  /** A missing required tool fails the preflight; an optional one only warns. */
  required: boolean;
  guidance: string;
};

const TOOLS: Tool[] = [
  {
    name: 'Node.js',
    bin: 'node',
    versionArgs: ['--version'],
    required: true,
    guidance: 'Install Node.js 22 or newer from https://nodejs.org',
  },
  {
    name: 'Claude Code CLI',
    bin: 'claude',
    versionArgs: ['--version'],
    required: false,
    guidance: 'Install from https://docs.claude.com/claude-code',
  },
  {
    name: 'Gemini CLI',
    bin: 'gemini',
    versionArgs: ['--version'],
    required: false,
    guidance: 'Install the Gemini CLI to use it as the reasoning harness',
  },
  {
    name: 'Google Cloud SDK',
    bin: 'gcloud',
    versionArgs: ['--version'],
    required: false,
    guidance:
      'Install from https://cloud.google.com/sdk/docs/install — required at runtime to sync and change infrastructure',
  },
  {
    name: 'Terraform',
    bin: 'terraform',
    versionArgs: ['--version'],
    required: false,
    guidance:
      'Optional — install from https://developer.hashicorp.com/terraform to verify generated plans',
  },
];

type Result = {
  tool: Tool;
  found: boolean;
  version?: string;
};

const firstLine = (text: string): string => text.trim().split('\n')[0]?.trim() ?? '';

async function probe(tool: Tool): Promise<Result> {
  try {
    const { stdout, stderr } = await run(tool.bin, tool.versionArgs, {
      timeout: 10_000,
    });
    return { tool, found: true, version: firstLine(stdout || stderr) };
  } catch {
    return { tool, found: false };
  }
}

const LABEL = { ok: 'ok      ', missing: 'missing ', optional: 'optional' } as const;

async function main(): Promise<void> {
  process.stdout.write('\nCloud Hermes — environment preflight\n\n');

  const results = await Promise.all(TOOLS.map(probe));

  for (const { tool, found, version } of results) {
    const label = found ? LABEL.ok : tool.required ? LABEL.missing : LABEL.optional;
    const detail = found ? (version ?? '') : tool.guidance;
    process.stdout.write(`  [${label}] ${tool.name.padEnd(20)} ${detail}\n`);
  }

  const byBin = new Map(results.map((r) => [r.tool.bin, r]));
  const nodeOk = byBin.get('node')?.found ?? false;
  const harnessOk = (byBin.get('claude')?.found ?? false) || (byBin.get('gemini')?.found ?? false);
  const gcloudOk = byBin.get('gcloud')?.found ?? false;

  process.stdout.write('\n');

  if (!nodeOk) {
    process.stdout.write('  Node.js is required and was not found. Cloud Hermes cannot start.\n\n');
    process.exit(1);
  }

  if (!harnessOk) {
    process.stdout.write(
      '  No reasoning harness found. Install the Claude Code CLI or the Gemini CLI,\n' +
        '  then run the preflight again. Cloud Hermes cannot start without one.\n\n',
    );
    process.exit(1);
  }

  if (!gcloudOk) {
    process.stdout.write(
      '  Ready to start. Note: gcloud is not installed yet — install it before\n' +
        '  connecting a project. Onboarding will walk you through authentication.\n\n',
    );
  } else {
    process.stdout.write('  Ready to start.\n\n');
  }

  process.exit(0);
}

void main();
