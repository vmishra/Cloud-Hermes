import type {
  OnboardingStatus,
  Workspace,
  HarnessId,
  GraphSlice,
  Insight,
  HermesResponse,
} from '@cloud-hermes/core';

/**
 * The REST client for onboarding, workspaces, conversation history, and memory.
 * The streaming conversation channel is the WebSocket; everything
 * request/response is here.
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

async function sendJson<T>(method: 'POST' | 'PUT', url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<T>;
}

const postJson = <T>(url: string, body: unknown): Promise<T> => sendJson<T>('POST', url, body);
const putJson = <T>(url: string, body: unknown): Promise<T> => sendJson<T>('PUT', url, body);

export interface GcloudProject {
  projectId: string;
  name: string;
}

export interface SyncResult {
  syncedAt: string;
  nodeCount: number;
  slices: GraphSlice[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export const api = {
  onboardingStatus: () => getJson<OnboardingStatus>('/api/onboarding/status'),
  listProjects: () => getJson<{ projects: GcloudProject[] }>('/api/onboarding/projects'),
  setProject: (projectId: string) =>
    postJson<{ ok: boolean; projectId: string }>('/api/onboarding/set-project', { projectId }),
  diagnose: (errorText: string) =>
    postJson<{ response: HermesResponse }>('/api/onboarding/diagnose', { errorText }),
  listWorkspaces: () => getJson<{ workspaces: Workspace[] }>('/api/workspaces'),
  createWorkspace: (input: { name: string; projectId: string; harness: HarnessId }) =>
    postJson<{ workspace: Workspace }>('/api/workspaces', input),
  syncWorkspace: (id: string) => postJson<SyncResult>(`/api/workspaces/${id}/sync`, {}),
  workspaceInsights: (id: string) =>
    getJson<{ syncedAt: string; insights: Insight[] }>(`/api/workspaces/${id}/insights`),
  listConversations: (workspaceId: string) =>
    getJson<{ conversations: ConversationSummary[] }>(
      `/api/workspaces/${workspaceId}/conversations`,
    ),
  loadConversation: (workspaceId: string, conversationId: string) =>
    getJson<{ id: string; markdown: string }>(
      `/api/workspaces/${workspaceId}/conversations/${conversationId}`,
    ),
  getMemory: (workspaceId: string) =>
    getJson<{ content: string }>(`/api/workspaces/${workspaceId}/memory`),
  putMemory: (workspaceId: string, content: string) =>
    putJson<{ ok: boolean }>(`/api/workspaces/${workspaceId}/memory`, { content }),
};
