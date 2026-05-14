import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/**
 * A minimal, read-only MCP client for Google Cloud MCP servers.
 *
 * Cloud Hermes is the MCP client — the reasoning CLI never is. The client
 * authenticates with an Application Default Credentials bearer token plus the
 * `x-goog-user-project` header, which scopes quota and billing.
 *
 * Read-only is *not* something a client can request. `tools/list` returns every
 * tool, including write tools; read-only enforcement is server-side, via IAM
 * deny policies on the `tool.isReadOnly` attribute. So this client is
 * deliberately disciplined — its callers invoke only a known enumeration tool
 * and honour the `readOnlyHint` annotation — and the real guarantee is the
 * operator scoping the credentials to viewer roles, or setting a deny policy.
 * See docs/MCP-INTEGRATION.md.
 */

export interface McpToolSummary {
  name: string;
  description: string | undefined;
  /** The MCP `readOnlyHint` annotation, when the server provides one. */
  readOnlyHint: boolean | undefined;
}

export interface McpClient {
  listTools(): Promise<McpToolSummary[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export interface McpConnectionOptions {
  endpoint: string;
  /** A short-lived Application Default Credentials access token. */
  token: string;
  /** The project quota and billing are scoped to (`x-goog-user-project`). */
  projectId: string;
}

const CLIENT_INFO = { name: 'cloud-hermes', version: '0.0.0' };

export async function connectMcpClient(options: McpConnectionOptions): Promise<McpClient> {
  const transport = new StreamableHTTPClientTransport(new URL(options.endpoint), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${options.token}`,
        'x-goog-user-project': options.projectId,
      },
    },
  });

  const client = new Client(CLIENT_INFO);
  await client.connect(transport);

  return {
    async listTools() {
      const result = await client.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        readOnlyHint: tool.annotations?.readOnlyHint,
      }));
    },

    async callTool(name, args) {
      const result = await client.callTool({ name, arguments: args });
      // Prefer the structured output; otherwise parse the first text block.
      if (result.structuredContent !== undefined) return result.structuredContent;
      const content = result.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (
            block !== null &&
            typeof block === 'object' &&
            (block as { type?: unknown }).type === 'text'
          ) {
            const text = (block as { text?: unknown }).text;
            if (typeof text === 'string') {
              try {
                return JSON.parse(text);
              } catch {
                return text;
              }
            }
          }
        }
      }
      return result;
    },

    async close() {
      await client.close();
    },
  };
}
