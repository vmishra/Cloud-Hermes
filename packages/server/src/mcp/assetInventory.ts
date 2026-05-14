import type { GraphFragment } from '../gcp/normalize';
import { EMPTY_FRAGMENT } from '../gcp/normalize';
import { getAdcToken } from '../onboarding/index';
import { connectMcpClient, type McpClient, type McpToolSummary } from './client';
import { normalizeAssets } from './assets';

/**
 * The Cloud Asset Inventory adapter — Hermes as a read-only MCP client.
 *
 * Fetches a project-wide resource inventory from the Google Cloud MCP server.
 * Read-only and Observe-stage only: it never reaches the guard, the policy
 * layer, the approval flow, or the audit log. Every failure path — no ADC
 * token, an unreachable endpoint, no suitable tool, a tool error — resolves to
 * an `unavailable` result, so an MCP slice fails exactly like any other sync
 * slice rather than throwing.
 */

const ASSET_INVENTORY_ENDPOINT = 'https://cloudasset.googleapis.com/mcp';

export interface AssetInventoryResult {
  status: 'ok' | 'unavailable';
  reason?: string;
  fragment: GraphFragment;
}

/**
 * Selects the enumeration tool from the server's tool list — deliberately, not
 * loosely. A tool is eligible only if its name reads as a resource search or
 * list AND its `readOnlyHint` annotation is not explicitly `false`. The client
 * never calls anything else: the read-only intent is enforced on the Hermes
 * side here, and on the IAM side by the operator's credential scoping.
 */
function pickEnumerationTool(tools: McpToolSummary[]): string | null {
  for (const tool of tools) {
    if (tool.readOnlyHint === false) continue;
    const name = tool.name.toLowerCase();
    const isEnumeration = name.includes('search') || name.includes('list');
    const isResource = name.includes('asset') || name.includes('resource');
    if (isEnumeration && isResource) return tool.name;
  }
  return null;
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export async function fetchAssetInventory(projectId: string): Promise<AssetInventoryResult> {
  const token = await getAdcToken();
  if (token === null) {
    return {
      status: 'unavailable',
      reason: 'no Application Default Credentials token — run gcloud auth application-default login',
      fragment: EMPTY_FRAGMENT,
    };
  }

  let client: McpClient | undefined;
  try {
    client = await connectMcpClient({ endpoint: ASSET_INVENTORY_ENDPOINT, token, projectId });

    const tools = await client.listTools();
    const toolName = pickEnumerationTool(tools);
    if (toolName === null) {
      return {
        status: 'unavailable',
        reason: 'the Asset Inventory MCP server exposed no read-only resource-enumeration tool',
        fragment: EMPTY_FRAGMENT,
      };
    }

    const raw = await client.callTool(toolName, { scope: `projects/${projectId}` });
    return { status: 'ok', fragment: normalizeAssets(raw) };
  } catch (err) {
    return {
      status: 'unavailable',
      reason: `Asset Inventory MCP query failed: ${message(err)}`,
      fragment: EMPTY_FRAGMENT,
    };
  } finally {
    await client?.close().catch(() => undefined);
  }
}
