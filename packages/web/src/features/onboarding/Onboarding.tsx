import { useEffect, useState } from 'react';
import type {
  HarnessId,
  HarnessStatus,
  HermesResponse,
  OnboardingStatus,
  Workspace,
} from '@cloud-hermes/core';
import { api, type GcloudProject } from '../../api/client';
import { ThemeToggle, type Theme } from '../../ui/theme';
import { ResponseView } from '../../ResponseView';

/**
 * The onboarding flow.
 *
 * A new workspace is linked to one Google Cloud project and one reasoning
 * harness. Onboarding detects the state of the environment and guides the
 * operator through whatever is missing, then creates the workspace and runs the
 * first state sync. A diagnose panel is always present, so an operator who hits
 * an error before a workspace exists can still get guided help.
 */

/**
 * The always-available "stuck?" panel. The operator pastes an error; the server
 * grounds a diagnosis in the real environment and walks them through it.
 */
function DiagnoseHelp() {
  const [open, setOpen] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HermesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (errorText.trim() === '') return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { response } = await api.diagnose(errorText.trim());
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-border bg-elev-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-3 text-sm text-text-muted"
      >
        <span>Stuck? Describe what you&apos;re seeing</span>
        <span className="text-text-subtle">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-5">
          <p className="text-xs text-text-muted">
            Paste the exact error or command output. Cloud Hermes reads your
            environment and walks you through it — with commands already filled in
            for your setup.
          </p>
          <textarea
            value={errorText}
            onChange={(event) => setErrorText(event.target.value)}
            rows={4}
            placeholder="gcloud: command not found"
            className="w-full resize-none rounded-md border border-border bg-surface-raised p-3 font-mono text-xs text-text outline-none focus:border-border-strong"
          />
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || errorText.trim() === ''}
            className="rounded-[var(--radius-lg)] bg-accent px-3.5 py-1.5 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04] disabled:opacity-40"
          >
            {busy ? 'Diagnosing…' : 'Diagnose'}
          </button>
          {error !== null && <p className="text-xs text-danger">{error}</p>}
          {result !== null && (
            <div className="rounded-md border border-border bg-surface-raised p-3 text-sm">
              <ResponseView response={result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Shell({
  children,
  theme,
  onToggleTheme,
}: {
  children: React.ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-6 py-10 text-text">
      <div className="w-full max-w-lg">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="font-display text-2xl">Cloud Hermes</h1>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <p className="mb-6 font-display text-base italic text-text-subtle">
          Connect a Google Cloud project to begin.
        </p>
        <div className="rounded-[var(--radius-lg)] border border-border bg-elev-1 p-6">
          {children}
        </div>
        <DiagnoseHelp />
      </div>
    </div>
  );
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 font-mono text-xs">
      <code className="flex-1 overflow-x-auto whitespace-nowrap text-text">{command}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded bg-accent px-2 py-1 text-[10px] uppercase tracking-wider text-accent-ink"
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
      className="rounded-[var(--radius-lg)] border border-border px-3 py-1.5 text-sm text-text-muted transition-colors duration-150 hover:border-border-strong"
    >
      Re-check
    </button>
  );
}

function InstallGcloud({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-text">The Google Cloud SDK is not installed</h2>
      <p className="text-sm text-text-muted">
        Cloud Hermes uses <code className="font-mono">gcloud</code> to read and change your
        project. Install the SDK, then re-check.
      </p>
      <a
        href="https://cloud.google.com/sdk/docs/install"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm text-accent underline"
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
      <h2 className="text-sm font-medium text-text">Authenticate gcloud</h2>
      <p className="text-sm text-text-muted">
        Run these in your terminal — each opens a browser sign-in — then re-check.
      </p>
      {status.gcloud.account === null && (
        <div className="space-y-1">
          <p className="text-xs text-text-subtle">Sign in your account</p>
          <CopyableCommand command="gcloud auth login" />
        </div>
      )}
      {!status.gcloud.adc && (
        <div className="space-y-1">
          <p className="text-xs text-text-subtle">Set application default credentials</p>
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
      <h2 className="text-sm font-medium text-text">No reasoning harness is ready</h2>
      <p className="text-sm text-text-muted">
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
      <h2 className="text-sm font-medium text-text">Create a workspace</h2>

      <label className="block space-y-1">
        <span className="text-xs text-text-subtle">Google Cloud project</span>
        <input
          list="cloud-hermes-projects"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value.trim())}
          placeholder="my-project-id"
          className="w-full rounded-[var(--radius-lg)] border border-border bg-surface-raised px-3 py-2 font-mono text-sm text-text outline-none focus:border-border-strong"
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
        <span className="text-xs text-text-subtle">Workspace name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Production network"
          className="w-full rounded-[var(--radius-lg)] border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none focus:border-border-strong"
        />
      </label>

      <div className="space-y-1">
        <span className="text-xs text-text-subtle">Reasoning harness</span>
        <div className="flex gap-2">
          {readyHarnesses.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setHarness(option.id)}
              className={`rounded-[var(--radius-lg)] border px-3 py-1.5 text-sm transition-colors duration-150 ${
                harness === option.id
                  ? 'border-accent bg-accent-soft text-text'
                  : 'border-border text-text-muted hover:border-border-strong'
              }`}
            >
              {option.id === 'claude' ? 'Claude Code' : 'Gemini'}
            </button>
          ))}
        </div>
      </div>

      {error !== null && (
        <p className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || name.trim() === '' || projectId === ''}
        className="w-full rounded-[var(--radius-lg)] bg-accent px-4 py-2 text-sm text-accent-ink transition-[filter] duration-150 hover:brightness-[1.04] disabled:opacity-40"
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

export function Onboarding({
  theme,
  onToggleTheme,
  onComplete,
}: {
  theme: Theme;
  onToggleTheme: () => void;
  onComplete: (workspace: Workspace) => void;
}) {
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
      <Shell theme={theme} onToggleTheme={onToggleTheme}>
        <div className="space-y-3">
          <p className="text-sm text-danger">Could not reach the server — {error}</p>
          <RecheckButton onRecheck={load} />
        </div>
      </Shell>
    );
  }

  if (status === null) {
    return (
      <Shell theme={theme} onToggleTheme={onToggleTheme}>
        <p className="font-display text-sm italic text-text-subtle">Checking your environment…</p>
      </Shell>
    );
  }

  const readyHarnesses = status.harnesses.filter((harness) => harness.ready);
  const gcloudAuthed =
    status.gcloud.installed && status.gcloud.account !== null && status.gcloud.adc;

  return (
    <Shell theme={theme} onToggleTheme={onToggleTheme}>
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
