# Architecture

Cloud Hermes is a harness — an orchestration layer — over a single Google Cloud
project. It does not reason on its own. It spawns a reasoning CLI as a
constrained subprocess and owns everything around it: the interface, the synced
state of the project, the skill catalog, the safety guard, the policy layer,
persistence, and every side-effecting command.

## The harness as a pure reasoning function

The `claude` or `gemini` CLI is launched in non-interactive mode with **all
side-effecting tools disabled**. It is treated as a stateless function: Hermes
assembles the entire prompt, the CLI returns text, Hermes extracts the
structured response. There is no hidden session — every turn is a fresh
invocation with the fully reassembled prompt, so what the model knows is always
exactly what Hermes put in front of it.

Each provider is a declarative profile (`packages/core/src/providers`) consumed
by one shared spawn/parse engine (`packages/server/src/harness`). Adding a
provider is adding a profile, not code.

**Spawn discipline.** Every subprocess — the reasoning CLI, `gcloud`,
`terraform` — goes through one boundary: an argument vector with no shell, an
explicit working directory, a filtered environment allowlist, a hard deadline
with `SIGTERM`-then-`SIGKILL` escalation, and an `AbortSignal` for cancellation.

**Unreliable JSON.** The CLI is asked for prose plus one fenced `json` block.
Model output is unreliable enough that the parser runs a deterministic salvage
path — the fenced block, then a balanced-object scan — before the orchestrator
spends a single structured re-ask.

## The prompt

Assembled in a fixed, unit-tested order: system framing, user memory, loaded
skills, project-state summary, conversation history, the current message. The
most stable content goes first so prompt caching pays off. Recalled memory is
context-fenced with a provenance marker, and the fence delimiters are stripped
from the content first so an edited memory file cannot forge the fence.

## The safety guard

An ordered pipeline of gates (`packages/core/src/safety`). Each gate can only
reject or pass to the next — never upgrade a verdict.

1. **Shell metacharacters** — any token carrying shell syntax is rejected.
2. **The hardline floor** — destructive verbs (`delete`, `destroy`, `remove-*`,
   `abandon-*`, and the rest) are `BLOCKED` unconditionally, before any
   allowlist. No skill file and no policy setting can lift this. It is code, not
   data.
3. **Tokenize** — the command is parsed into structure; every token is
   NFKC-normalized first, so fullwidth or zero-width characters cannot smuggle a
   verb past.
4. **Capability-table lookup** — a command runs only if a skill positively
   declares it. Default-deny: anything undeclared is `BLOCKED`.
5. **Flag denylist** — per-capability denied flag prefixes.
6. **Classify** — the survivor is `READ`, `CREATE`, or `UPDATE`.

On top sits the **Guardian policy layer**: a per-workspace `policy.json` that
narrows further — allowed regions, zones, services, machine types, CIDR ranges —
but can only ever reject more, never permit more.

Terraform is classified by its **plan**, not its source: `terraform plan` output
is walked for concrete `delete` actions, because an `apply` on a changed
immutable field is a destroy-then-create that the verb alone does not reveal.

## The resource graph

State sync (`packages/server/src/gcp`) pulls the live project through read-only
`gcloud` calls — themselves classified by the same guard — and normalizes the
raw JSON into a typed graph of nodes and relationship edges. The graph powers
grounded answers, dependency-aware planning, and the blast-radius computation on
every approval card. Sync slices run in parallel and fail independently: an
unreadable slice is marked `unavailable` with its reason, never silently empty.
The live project is the source of truth; the graph is a timestamped cache.

## Skills

One markdown file per Google Cloud service (`packages/skills`). Machine-read
YAML frontmatter, plus a body fed to the reasoning CLI. The frontmatter
`capabilities` block is the **single source** consulted by two consumers: the
prompt assembler reads its command templates for guidance, and the safety guard
derives its allowlist from it. There is no second copy.

Skills load **progressively**: the prompt carries only the compact manifest
index until the CLI requests a skill by id; Hermes then resolves the dependency
closure and folds the full bodies in, bounded so the loop cannot run away. A
skill whose frontmatter fails validation is excluded and the build fails — a
malformed capability table must never become a permissive one.

## Execution

A plan step names a skill capability and parameter values. For the **run** path:
parameters are validated against their declared constraints, the template is
interpolated into an argument vector, and that final vector is **re-classified
through the full guard pipeline** — interpolation is never trusted to have
preserved the template's safety. The policy layer narrows the verdict, a
blast-radius approval card is shown, and only on approval does the command reach
the single execution chokepoint. The approval flow is fail-closed: a
disconnect, an abort, or a new message denies every pending approval. After
execution, the graph is re-synced so the snapshot reflects reality.

The **commands** and **terraform** paths never touch the project from Hermes —
they are still classified and labelled, but the human runs them.

## Secret redaction

Every chunk of subprocess output bound for the live terminal view or the
reasoning model passes through a redactor first. Hermes streams `gcloud auth`
flows; the terminal view must not become a credential-exfiltration surface.

## Persistence

Each workspace is a directory on disk. Conversations are markdown files — the
source of truth — with turns appended as sections. Memory is a single markdown
file the operator owns. Synced state is `graph.json`. The audit log is
append-only JSON lines. Plain files, inspectable and editable by hand.

## What is deliberately deferred

The walking skeleton draws the seams for, but does not yet build: the xterm.js
terminal drawer (the terminal is a styled log for now), the command palette,
multi-user accounts and shared workspaces, and the end-of-conversation
memory-extraction pass. The data model and APIs are shaped so each is an
addition, not a rewrite.

The **Google Cloud MCP server** integration is decided and deferred to v2 —
Hermes as a read-only MCP client feeding the Observe stage (a project-wide
resource graph via Cloud Asset Inventory, richer Insights via the observability
servers). The reasoning CLI is never an MCP client, because that would bypass
the guard. See [MCP-INTEGRATION.md](./MCP-INTEGRATION.md) for the full decision.
