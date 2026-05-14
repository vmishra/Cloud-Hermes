# MCP integration — architecture decision

**Status:** implemented, **opt-in**, pending validation against a live Google
Cloud project. Enable with `CLOUD_HERMES_MCP_ENABLED=1`. Off by default — the
walking skeleton is untouched unless the operator opts in.

This records how the **Google Cloud MCP server** fits into Cloud Hermes — what
was built, and, just as important, what was not.

## Background

Google Cloud publishes official **MCP servers** — Model Context Protocol
endpoints, remote, one HTTPS endpoint per product (`compute.googleapis.com/mcp`,
`cloudasset.googleapis.com/mcp`, and ~40 others). They expose Tools, Prompts,
and Resources over HTTP transport, authenticated with Application Default
Credentials, service accounts, or OAuth.

The trust model is explicit: *"actions taken by the AI application through tool
calling are attributed to you,"* and the client *"has the same permissions as
you do."*

## The hard constraint: MCP never reaches the reasoning CLI

Cloud Hermes' safety model rests on one principle: **the reasoning CLI is a
no-tools reasoning function.** It proposes; Hermes validates and executes
through the ordered guard — shell-metachar rejection, the HARDLINE floor,
capability-table lookup, the policy layer, the blast-radius approval card, the
single execution chokepoint, the append-only audit log.

Wiring the `claude` or `gemini` CLI directly to a Google Cloud MCP server would
let it create, modify, or delete resources **invisibly to that entire
pipeline**. So:

> **The reasoning CLI is never an MCP client. Hermes is the MCP client.**

## How "read-only" actually works — and what that means for us

Reading the access-control docs changed the design. Read-only is **not** a thing
a client can request:

- `tools/list` returns **every** tool, including write tools. There is no header
  or parameter to ask for a read-only subset.
- Read-only enforcement is **server-side, via IAM deny policies** on the
  `mcp.googleapis.com/tools.call` permission, conditioned on the
  `tool.isReadOnly` attribute. A non-read-only call then fails with an HTTP
  client error.
- To call *any* MCP tool, the principal needs `roles/mcp.toolUser`
  (`mcp.tools.call`) on the project.

So "Hermes is a read-only MCP client" is enforced in **three layers**, and the
operator owns the strongest one:

1. **Hermes-side discipline (in this codebase).** The MCP client is deliberately
   narrow: the Asset Inventory adapter lists tools, selects *one* tool that reads
   as a resource search/list and whose `readOnlyHint` annotation is not
   explicitly `false`, and calls only that. It never calls arbitrary tools.
2. **Credential scoping (the operator's responsibility — the real guarantee).**
   The ADC credentials Hermes uses for MCP should hold only **viewer-level
   roles**. Then even a mistaken write call fails at the underlying API. This is
   the layer that actually matters, and it is documented for the operator.
3. **IAM deny policy (optional, belt-and-suspenders).** An org/project deny
   policy with `tool.isReadOnly == false` blocks every write tool centrally.

The code cannot promise read-only on its own; it is disciplined, and it is
honest that the operator must scope the credentials.

## What was built

A read-only MCP client, confined to the **Observe** stage of the operating loop.
It never touches Plan, Execute, the guard, the policy layer, the approval flow,
or the audit log.

- `server/src/mcp/client.ts` — a thin MCP client over the official
  `@modelcontextprotocol/sdk` HTTP transport. Authenticates with an ADC bearer
  token **and** the `x-goog-user-project` header (quota and billing scoping).
  `listTools` surfaces each tool's `readOnlyHint`.
- `server/src/mcp/assets.ts` — `normalizeAssets`, a pure, unit-tested function:
  Cloud Asset Inventory JSON in, resource-graph nodes out. It **skips** asset
  types the gcloud sync slices already cover in detail, so the MCP slice purely
  adds breadth and never duplicates a node.
- `server/src/mcp/assetInventory.ts` — the adapter: get an ADC token, connect to
  `cloudasset.googleapis.com/mcp`, select the read-only enumeration tool, call
  it, normalize. Every failure path — no token, unreachable endpoint, no
  suitable tool, a tool error — resolves to an `unavailable` result, so an MCP
  slice fails exactly like any other sync slice rather than throwing.
- `server/src/gcp/stateSync.ts` — when `MCP_ENABLED`, `syncState` adds an
  `asset-inventory` slice. When disabled or failing, the graph is exactly what
  the gcloud slices produced.
- `core` — a generic `asset` `GraphNodeKind`; `summarizeGraph` renders the
  asset nodes under "Other resources." MCP-sourced data reaches the reasoning
  model only through that summary — never as a tool the model can call.

The result: when enabled and authorized, Converse mode and Insights see the
**whole project**, not just the four skill-backed services — while **Execute
stays exactly as gated as it was**: a plan still only runs a command a skill's
capability table positively declares.

## What still needs live validation

The exact **tool name and argument schema** of `cloudasset.googleapis.com/mcp`
are not in the public docs. The adapter therefore *discovers* the enumeration
tool at runtime rather than hard-coding a name, and passes a minimal
`{ scope: "projects/<id>" }` argument. Against a live, MCP-enabled project this
may need the argument shape pinned down — at which point the adapter's
`pickEnumerationTool` and the call arguments are the only things to adjust.
Everything else — auth, transport, normalization, the slice seam, graceful
degradation — typechecks against the real SDK and is unit-tested.

## What is explicitly rejected

- **MCP into the reasoning CLI** — breaks the safety model.
- **MCP-based execution** — replacing `gcloud` subprocesses with MCP tool calls
  for mutations. The guard classifies a tokenized `gcloud` argv; MCP tool calls
  are a different classification surface. The gcloud execution path works, is
  classified, and is audited. Leave it.
- **Replacing the working gcloud sync slices** — the win is *added breadth* via
  Asset Inventory, not swapping a working, classified path.

## Still deferred

The observability MCP servers (Logging, Monitoring, Error Reporting, Network
Intelligence) would let Insights read operational signal, not just static
config. The seam is the same — `runInsights` is already `(graph) => Insight[]` —
but it is a follow-on, not part of this change.

## Sources

- https://docs.cloud.google.com/mcp/overview
- https://docs.cloud.google.com/mcp/supported-products
- https://docs.cloud.google.com/mcp/authenticate-mcp
- https://docs.cloud.google.com/mcp/configure-mcp-ai-application
- https://docs.cloud.google.com/mcp/prevent-read-write-tool-use
- https://docs.cloud.google.com/mcp/control-mcp-use-iam
- https://docs.cloud.google.com/mcp/access-control
