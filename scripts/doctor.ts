/**
 * Cloud Hermes — environment preflight.
 *
 * Run with `npm run doctor`. Detects the tooling Cloud Hermes depends on, then
 * runs a self-test against each reasoning harness that is present.
 *
 * The hard gate is binary presence: the app needs Node and at least one
 * harness binary (Claude Code or Gemini) to start. The self-test goes further
 * — it runs a trivial structured query and confirms the harness is
 * authenticated and its output still parses. A failing self-test does not
 * block startup (onboarding guides authentication), but it is reported
 * prominently, because a CLI that is installed-but-not-working fails silently
 * otherwise.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ProviderId } from '@cloud-hermes/core';
import { createProviderById, selfTestProvider } from '../packages/server/src/harness/index';

const run = promisify(execFile);

type Tool = {
  name: string;
  bin: string;
  versionArgs: string[];
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

const HARNESS_BINS = new Set<string>(['claude', 'gemini']);

type Result = { tool: Tool; found: boolean; version?: string };

const firstLine = (text: string): string => text.trim().split('\n')[0]?.trim() ?? '';

async function probe(tool: Tool): Promise<Result> {
  try {
    const { stdout, stderr } = await run(tool.bin, tool.versionArgs, { timeout: 10_000 });
    return { tool, found: true, version: firstLine(stdout || stderr) };
  } catch {
    return { tool, found: false };
  }
}

const LABEL = {
  ok: 'ok      ',
  missing: 'missing ',
  optional: 'optional',
} as const;

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
  const presentHarnesses = [...HARNESS_BINS].filter(
    (bin): bin is ProviderId => byBin.get(bin)?.found ?? false,
  );
  const gcloudOk = byBin.get('gcloud')?.found ?? false;

  // Self-test each present harness — presence is not the same as working.
  let anyHarnessWorks = false;
  if (presentHarnesses.length > 0) {
    process.stdout.write('\n  Harness self-test\n');
    for (const id of presentHarnesses) {
      const provider = createProviderById(id);
      const test = await selfTestProvider(provider);
      const label = test.ok ? LABEL.ok : LABEL.missing;
      const timing = test.durationMs ? ` (${test.durationMs} ms)` : '';
      process.stdout.write(
        `  [${label}] ${provider.profile.displayName.padEnd(20)} ${test.detail}${timing}\n`,
      );
      if (test.ok) anyHarnessWorks = true;
    }
  }

  process.stdout.write('\n');

  if (!nodeOk) {
    process.stdout.write('  Node.js is required and was not found. Cloud Hermes cannot start.\n\n');
    process.exit(1);
  }

  if (presentHarnesses.length === 0) {
    process.stdout.write(
      '  No reasoning harness found. Install the Claude Code CLI or the Gemini CLI,\n' +
        '  then run the preflight again. Cloud Hermes cannot start without one.\n\n',
    );
    process.exit(1);
  }

  if (!anyHarnessWorks) {
    process.stdout.write(
      '  A harness is installed but none passed the self-test — most often this means\n' +
        '  it is not authenticated yet. You can still start Cloud Hermes; onboarding will\n' +
        '  walk you through authenticating your harness.\n\n',
    );
  } else if (!gcloudOk) {
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
