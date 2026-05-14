# MCP integration — architecture decision

**Status:** decided, deferred to v2. The seam exists; the code does not yet.

This records how the **Google Cloud MCP server** fits into Cloud Hermes — what
to do with it, and, just as important, what not to do.

## Background

Google Cloud now publishes official **MCP servers** — Model Context Protocol
endpoints, mostly remote (one HTTPS endpoint per product, e.g.
`compute.googleapis.com/mcp`, `logging.googleapis.com/mcp`,
`cloudasset.googleapis.com/mcp`), covering ~40 products. They expose Tools,
Prompts, and Resources; authenticate with Application Default Credentials,
service accounts, or OAuth; and integrate with IAM, VPC Service Controls, and
Model Armor.

The documentation is explicit about the trust model: *"actions taken by the AI
application through tool calling are attributed to you,"* and the client *"has
the same permissions as you do."* A coarse "read-write tool prevention" toggle
exists, but it is a toggle — not a policy engine.

## The hard constraint: MCP must not reach the reasoning CLI

Cloud Hermes' safety model rests on one principle: **the reasoning CLI is a
no-tools reasoning function.** It proposes; Hermes validates and executes
through the ordered guard — shell-metachar rejection, the HARDLINE floor,
capability-table lookup, the policy layer, the blast-radius approval card, the
single execution chokepoint, the append-only audit log.

Wiring the `claude` or `gemini` CLI directly to a Google Cloud MCP server would
let it create, modify, or delete resources **invisibly to that entire
pipeline**. The MCP server's read-write toggle is not a replacement for a
default-deny, HARDLINE-floored, capability-gated classifier. So:

> **The reasoning CLI is never an MCP client. Ever. If MCP is used, Hermes is
> the MCP client.**

This is consistent with the original plan and `learning.md` §4.7: the CLI has no
file or network tools, and Hermes-internal data is never handed to it.

## Where MCP genuinely helps — the Observe stage, read-only

The valuable incorporation is **Hermes itself as a read-only MCP client**,
confined to the **Observe** stage of the operating loop. It never touches Plan,
Execute, the guard, the approval flow, or the audit log.

### 1. Cloud Asset Inventory MCP — a project-wide resource graph (primary win)

Today, `syncState` shells out to read-only `gcloud` calls for the four
skill-backed services (networks, subnets, instances, firewall rules). The
`cloudasset.googleapis.com/mcp` server enumerates **every asset in the project**.

Adding it as a second, read-only source for the resource graph means Converse
mode and Insights become **project-wide** — they can answer about Cloud SQL,
GKE, buckets, and everything else — while **Execute stays exactly as gated as it
is now**: a plan can still only run a command a skill's capability table
positively declares. Broader Observe, unchanged Execute. This is the single
most valuable integration.

### 2. Observability MCP servers — richer Insights

`logging.googleapis.com/mcp`, `monitoring.googleapis.com/mcp`,
`clouderrorreporting.googleapis.com/mcp`, and `networkmanagement.googleapis.com/mcp`
expose operational signal. Insights today runs best-practice checks against
static config; with operational signal it goes from *"this firewall rule is
permissive"* to *"…and it is seeing ingress from ranges outside the project."*
Still read-only, still advisory, still non-destructive.

## What is explicitly rejected

- **MCP into the reasoning CLI** — breaks the safety model (above).
- **MCP-based execution** — replacing `gcloud` subprocesses with MCP tool calls
  for mutations. The guard classifies a tokenized `gcloud` argv; MCP tool calls
  are a different classification surface. It is not impossible — and a typed
  `{toolName, args}` is arguably *cleaner* to classify than an argv string — but
  it is a re-architecture of the guard, not an improvement to it. The gcloud
  execution path works, is classified, and is audited. Leave it.
- **MCP for the current state-sync slices** — the four `gcloud list` slices work
  and are classified through the same guard as everything else. There is no win
  in swapping a working path; the win is *adding breadth* via Asset Inventory,
  not replacing what exists.

## Authentication — already covered

The GCP MCP servers consume **Application Default Credentials**. Cloud Hermes'
onboarding already runs `gcloud auth application-default login` and confirms ADC
is present. So when the MCP client is built, **its authentication is already
established by onboarding** — there is no new auth flow to design. The same
least-privilege guidance applies: the credentials Hermes uses for MCP reads need
only viewer-level roles.

## The code seam

When this is built:

- A new `server/src/mcp/` module — Hermes as the MCP client. An MCP client
  library speaking to the remote endpoints over HTTPS, authenticated via ADC.
- It feeds **two existing consumers**, both already built and tested:
  - `syncState` (`server/src/gcp/`) gains an Asset Inventory source; the
    `ResourceGraph` schema already models arbitrary node kinds, and a sync slice
    is already `{ slice, status, reason?, data }` — an MCP slice slots in
    alongside the gcloud slices with no schema change.
  - `runInsights` (`core/src/insights/`) gains checks that read operational
    signal; `InsightCheck` is already `(graph) => Insight[]`, and the graph can
    carry the extra MCP-sourced data.
- The reasoning CLI's prompt is unchanged — it still only ever sees the compact
  graph summary Hermes assembles. MCP data reaches the model only through that
  summary, never through a tool the model can call.
- Output from MCP calls passes through the existing secret redactor before it
  reaches the model or the terminal view.

Nothing about the guard, the policy layer, the approval flow, or the audit log
changes. MCP is purely additive to Observe.

## Sources

- https://docs.cloud.google.com/mcp/overview
- https://docs.cloud.google.com/mcp/supported-products
- https://docs.cloud.google.com/mcp/authenticate-mcp
