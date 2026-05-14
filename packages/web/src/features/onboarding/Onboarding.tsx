import { useEffect, useState } from 'react';
import type { HarnessId, HarnessStatus, OnboardingStatus, Workspace } from '@cloud-hermes/core';
import { api, type GcloudProject } from '../../api/client';

/**
 * The onboarding flow.
 *
 * A new workspace is linked to one Google Cloud project and one reasoning
 * harness. Onboarding detects the state of the environment — is gcloud
 * installed, is it authenticated, which harnesses are ready — and guides the
 * operator through whatever is missing rather than driving fragile interactive
 * auth itself. The final step creates the workspace and runs the first state
 * sync. The designed treatment of this flow comes with the design-system pass.
 */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 px-6 text-neutral-900">
      <div className="w-full max-w-lg">
        <h1 className="mb-1 text-xl font-medium tracking-tight">Cloud Hermes</h1>
        <p className="mb-6 text-sm text-neutral-500">Connect a Google Cloud project to begin.</p>
        <div className="rounded-xl border border-neutral-200 bg-white p-6">{children}</div>
      </div>
    </div>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 font-mono text-xs">
      <code className="flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded bg-neutral-900 px-2 py-1 text-[11px] text-neutral-50"
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  );
}

function RecheckButton({ onRecheck }: { onRecheck: () => void }) {
  return (
    <button
      type="button"
      onClick={onRecheck}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
    >
      Re-check
    </button>
  );
}

function InstallGcloud({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">The Google Cloud SDK is not installed</h2>
      <p className="text-sm text-neutral-600">
        Cloud Hermes uses <code className="font-mono">gcloud</code> to read and change your
        project. Install the SDK, then re-check.
      </p>
      <a
        href="https://cloud.google.com/sdk/docs/install"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm text-neutral-900 underline"
      >
        Installation guide
      </a>
      <div>
        <RecheckButton onRecheck={onRecheck} />
      </div>
    </div>
  );
}

function Authenticate({
  status,
  onRecheck,
}: {
  status: OnboardingStatus;
  onRecheck: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Authenticate gcloud</h2>
      <p className="text-sm text-neutral-600">
        Run these in your terminal — each opens a browser sign-in — then re-check.
      </p>
      {status.gcloud.account === null && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">Sign in your account</p>
          <CopyableCommand command="gcloud auth login" />
        </div>
      )}
      {!status.gcloud.adc && (
        <div className="space-y-1">
          <p className="text-xs text-neutral-500">Set application default credentials</p>
          <CopyableCommand command="gcloud auth application-default login" />
        </div>
      )}
      <div>
        <RecheckButton onRecheck={onRecheck} />
      </div>
    </div>
  );
}

function NoHarness({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">No reasoning harness is ready</h2>
      <p className="text-sm text-neutral-600">
        Cloud Hermes needs the Claude Code CLI or the Gemini CLI, installed and
        authenticated. Install one, sign in, then re-check.
      </p>
      <div>
        <RecheckButton onRecheck={onRecheck} />
      </div>
    </div>
  );
}

function Configure({
  status,
  readyHarnesses,
  onComplete,
}: {
  status: OnboardingStatus;
  readyHarnesses: HarnessStatus[];
  onComplete: (workspace: Workspace) => void;
}) {
  const [projects, setProjects] = useState<GcloudProject[]>([]);
  const [projectId, setProjectId] = useState(status.gcloud.project ?? '');
  const [name, setName] = useState('');
  const [harness, setHarness] = useState<HarnessId>(readyHarnesses[0]!.id);
  const [step, setStep] = useState<'idle' | 'creating' | 'syncing'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((result) => setProjects(result.projects))
      .catch(() => setProjects([]));
  }, []);

  const busy = step !== 'idle';

  const create = async () => {
    setError(null);
    try {
      setStep('creating');
      if (projectId !== status.gcloud.project) await api.setProject(projectId);
      const { workspace } = await api.createWorkspace({ name: name.trim(), projectId, harness });
      setStep('syncing');
      await api.syncWorkspace(workspace.id);
      onComplete(workspace);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setStep('idle');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Create a workspace</h2>

      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">Google Cloud project</span>
        <input
          list="cloud-hermes-projects"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value.trim())}
          placeholder="my-project-id"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-500"
        />
        <datalist id="cloud-hermes-projects">
          {projects.map((project) => (
            <option key={project.projectId} value={project.projectId}>
              {project.name}
            </option>
          ))}
        </datalist>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-neutral-500">Workspace name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Production network"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs text-neutral-500">Reasoning harness</span>
        <div className="flex gap-2">
          {readyHarnesses.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setHarness(option.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                harness === option.id
                  ? 'border-neutral-900 bg-neutral-900 text-neutral-50'
                  : 'border-neutral-300'
              }`}
            >
              {option.id === 'claude' ? 'Claude Code' : 'Gemini'}
            </button>
          ))}
        </div>
      </div>

      {error !== null && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || name.trim() === '' || projectId === ''}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm text-neutral-50 disabled:opacity-40"
      >
        {step === 'creating'
          ? 'Creating workspace…'
          : step === 'syncing'
            ? 'Syncing project state…'
            : 'Create workspace'}
      </button>
    </div>
  );
}

export function Onboarding({ onComplete }: { onComplete: (workspace: Workspace) => void }) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setStatus(null);
    api
      .onboardingStatus()
      .then(setStatus)
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  };

  useEffect(load, []);

  if (error !== null) {
    return (
      <Shell>
        <div className="space-y-3">
          <p className="text-sm text-red-700">Could not reach the server — {error}</p>
          <RecheckButton onRecheck={load} />
        </div>
      </Shell>
    );
  }

  if (status === null) {
    return (
      <Shell>
        <p className="text-sm text-neutral-500">Checking your environment…</p>
      </Shell>
    );
  }

  const readyHarnesses = status.harnesses.filter((harness) => harness.ready);
  const gcloudAuthed =
    status.gcloud.installed && status.gcloud.account !== null && status.gcloud.adc;

  return (
    <Shell>
      {!status.gcloud.installed ? (
        <InstallGcloud onRecheck={load} />
      ) : !gcloudAuthed ? (
        <Authenticate status={status} onRecheck={load} />
      ) : readyHarnesses.length === 0 ? (
        <NoHarness onRecheck={load} />
      ) : (
        <Configure status={status} readyHarnesses={readyHarnesses} onComplete={onComplete} />
      )}
    </Shell>
  );
}
