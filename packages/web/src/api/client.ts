import type { OnboardingStatus, Workspace, HarnessId, GraphSlice } from '@cloud-hermes/core';

/**
 * The REST client for onboarding and workspace management. The streaming
 * conversation channel is the WebSocket; everything request/response is here.
 */

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return typeof body['error'] === 'string' ? body['error'] : `Request failed (${response.status})`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

export interface GcloudProject {
  projectId: string;
  name: string;
}

export interface SyncResult {
  syncedAt: string;
  nodeCount: number;
  slices: GraphSlice[];
}

export const api = {
  onboardingStatus: () => getJson<OnboardingStatus>('/api/onboarding/status'),
  listProjects: () => getJson<{ projects: GcloudProject[] }>('/api/onboarding/projects'),
  setProject: (projectId: string) =>
    postJson<{ ok: boolean; projectId: string }>('/api/onboarding/set-project', { projectId }),
  createWorkspace: (input: { name: string; projectId: string; harness: HarnessId }) =>
    postJson<{ workspace: Workspace }>('/api/workspaces', input),
  syncWorkspace: (id: string) =>
    postJson<SyncResult>(`/api/workspaces/${id}/sync`, {}),
};
