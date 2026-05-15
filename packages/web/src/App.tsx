import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from './api/client';
import { useTheme } from './ui/theme';
import { Wordmark } from './ui/atoms';
import { Onboarding } from './features/onboarding/Onboarding';
import { WorkspaceShell } from './WorkspaceShell';

/**
 * The shell router. On load it asks the server what exists: with no workspace,
 * it shows onboarding; with one, it opens the workspace. Theme is owned here —
 * light by default — and threaded down.
 */

const ACTIVE_WORKSPACE_KEY = 'cloud-hermes:active-workspace';

type Phase =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'workspace'; workspace: Workspace };

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const { theme, toggle } = useTheme();

  useEffect(() => {
    api
      .onboardingStatus()
      .then((status) => {
        const savedId = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
        const active =
          status.workspaces.find((workspace) => workspace.id === savedId) ??
          status.workspaces[0] ??
          null;
        setPhase(active ? { kind: 'workspace', workspace: active } : { kind: 'onboarding' });
      })
      .catch(() => setPhase({ kind: 'onboarding' }));
  }, []);

  if (phase.kind === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg">
        <Wordmark size={20} />
        <span className="display text-sm text-ink-4">Waking the harness…</span>
      </div>
    );
  }

  if (phase.kind === 'onboarding') {
    return (
      <Onboarding
        theme={theme}
        onToggleTheme={toggle}
        onComplete={(workspace) => {
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
          setPhase({ kind: 'workspace', workspace });
        }}
      />
    );
  }

  return (
    <WorkspaceShell
      key={phase.workspace.id}
      workspace={phase.workspace}
      theme={theme}
      onToggleTheme={toggle}
      onSwitchWorkspace={(workspace) => {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
        setPhase({ kind: 'workspace', workspace });
      }}
    />
  );
}
