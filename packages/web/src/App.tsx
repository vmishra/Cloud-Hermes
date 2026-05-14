import { useEffect, useState } from 'react';
import type { Workspace } from '@cloud-hermes/core';
import { api } from './api/client';
import { Onboarding } from './features/onboarding/Onboarding';
import { Conversation } from './Conversation';

/**
 * The shell router. On load it asks the server what exists: with no workspace,
 * it shows onboarding; with one, it opens the conversation. The dual-pane
 * workspace layout is built on top of this in the design-system pass.
 */

const ACTIVE_WORKSPACE_KEY = 'cloud-hermes:active-workspace';

type Phase =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'workspace'; workspace: Workspace };

export function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });

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
      <div className="flex min-h-dvh items-center justify-center bg-neutral-50 text-sm text-neutral-400">
        Loading…
      </div>
    );
  }

  if (phase.kind === 'onboarding') {
    return (
      <Onboarding
        onComplete={(workspace) => {
          localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace.id);
          setPhase({ kind: 'workspace', workspace });
        }}
      />
    );
  }

  return <Conversation workspace={phase.workspace} />;
}
