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
import { Wordmark, Btn, CodeLine, Surface } from '../../ui/atoms';
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

/** The always-available "stuck?" panel — paste an error, get a guided fix. */
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
    <Surface className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-3 text-[13px] text-ink-3"
      >
        <span>Stuck? Describe what you&apos;re seeing</span>
        <span className="text-ink-4">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="hair-t space-y-3 p-5">
          <p className="text-[12px] text-ink-3">
            Paste the exact error or command output. Cloud Hermes reads your
            environment and walks you through it — with commands already filled in
            for your setup.
          </p>
          <textarea
            value={errorText}
            onChange={(event) => setErrorText(event.target.value)}
            rows={4}
            placeholder="gcloud: command not found"
            className="w-full resize-none rounded-[var(--radius-2)] border border-border bg-surface p-3 font-mono text-[12px] text-ink outline-none focus:border-border-strong"
          />
          <Btn
            variant="primary"
            size="md"
            onClick={() => void run()}
            disabled={busy || errorText.trim() === ''}
          >
            {busy ? 'Diagnosing…' : 'Diagnose'}
          </Btn>
          {error !== null && <p className="text-[12px] text-danger">{error}</p>}
          {result !== null && (
            <div className="rounded-[var(--radius-3)] border border-hairline bg-surface p-3 text-[13px] text-ink">
              <ResponseView response={result} />
            </div>
          )}
        </div>
      )}
    </Surface>
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
    <div className="flex min-h-dvh items-center justify-center bg-bg px-6 py-10 text-ink">
      <div className="w-full max-w-lg">
        <div className="mb-1 flex items-center justify-between">
          <Wordmark size={20} />
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <p className="display mb-6 text-base text-ink-4">
          Connect a Google Cloud project to begin.
        </p>
        <Surface className="p-6">{children}</Surface>
        <DiagnoseHelp />
      </div>
    </div>
  );
}

function RecheckButton({ onRecheck }: { onRecheck: () => void }) {
  return (
    <Btn variant="secondary" size="md" onClick={onRecheck}>
      Re-check
    </Btn>
  );
}

function InstallGcloud({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-[13px] font-medium text-ink">The Google Cloud SDK is not installed</h2>
      <p className="text-[13px] text-ink-3">
        Cloud Hermes uses <code className="mono">gcloud</code> to read and change your project.
        Install the SDK, then re-check.
      </p>
      <a
        href="https://cloud.google.com/sdk/docs/install"
        target="_blank"
        rel="noreferrer"
        className="inline-block text-[13px] text-accent underline"
      >
        Installation guide
      </a>
      <div>
        <RecheckButton onRecheck={onRecheck} />
      </div>
    </div>
  );
}

function Authenticate({ status, onRecheck }: { status: OnboardingStatus; onRecheck: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-[13px] font-medium text-ink">Authenticate gcloud</h2>
      <p className="text-[13px] text-ink-3">
        Run these in your terminal — each opens a browser sign-in — then re-check.
      </p>
      {status.gcloud.account === null && (
        <div className="space-y-1">
          <p className="eyebrow">Sign in your account</p>
          <CodeLine copyable prefix="$">
            gcloud auth login
          </CodeLine>
        </div>
      )}
      {!status.gcloud.adc && (
        <div className="space-y-1">
          <p className="eyebrow">Set application default credentials</p>
          <CodeLine copyable prefix="$">
            gcloud auth application-default login
          </CodeLine>
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
      <h2 className="text-[13px] font-medium text-ink">No reasoning harness is ready</h2>
      <p className="text-[13px] text-ink-3">
        Cloud Hermes needs the Claude Code CLI or the Gemini CLI, installed and authenticated.
        Install one, sign in, then re-check.
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
      <h2 className="text-[13px] font-medium text-ink">Create a workspace</h2>

      <label className="block space-y-1">
        <span className="eyebrow">Google Cloud project</span>
        <input
          list="cloud-hermes-projects"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value.trim())}
          placeholder="my-project-id"
          className="w-full rounded-[var(--radius-3)] border border-border bg-surface px-3 py-2 font-mono text-[13px] text-ink outline-none focus:border-border-strong"
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
        <span className="eyebrow">Workspace name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Production network"
          className="w-full rounded-[var(--radius-3)] border border-border bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-border-strong"
        />
      </label>

      <div className="space-y-1">
        <span className="eyebrow">Reasoning harness</span>
        <div className="flex gap-2">
          {readyHarnesses.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setHarness(option.id)}
              className={`rounded-[var(--radius-3)] border px-3 py-1.5 text-[13px] transition-colors duration-150 ${
                harness === option.id
                  ? 'border-accent-line bg-accent-soft text-ink'
                  : 'border-border text-ink-3 hover:border-border-strong'
              }`}
            >
              {option.id === 'claude' ? 'Claude Code' : 'Gemini'}
            </button>
          ))}
        </div>
      </div>

      {error !== null && (
        <p className="rounded-[var(--radius-2)] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}

      <Btn
        variant="primary"
        size="lg"
        onClick={() => void create()}
        disabled={busy || name.trim() === '' || projectId === ''}
        className="w-full"
      >
        {step === 'creating'
          ? 'Creating workspace…'
          : step === 'syncing'
            ? 'Syncing project state…'
            : 'Create workspace'}
      </Btn>
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
          <p className="text-[13px] text-danger">Could not reach the server — {error}</p>
          <RecheckButton onRecheck={load} />
        </div>
      </Shell>
    );
  }

  if (status === null) {
    return (
      <Shell theme={theme} onToggleTheme={onToggleTheme}>
        <p className="display text-[13px] text-ink-4">Checking your environment…</p>
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
