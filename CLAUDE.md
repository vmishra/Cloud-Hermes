# Cloud Hermes — project context for Claude

This file is the orientation document for any Claude session working on this
repository. It captures what the project is, the architecture and the design
decisions behind it, the data flow, the folder structure, what is done, and what
is deliberately deferred — so a fresh session is fully oriented without the user
re-explaining anything.

---

## 1. What Cloud Hermes is

A **conversational orchestration layer ("harness") over a single Google Cloud
project**. Cloud architects and DevOps teams talk to it — by voice or text — to
understand what exists and to create or update infrastructure. It is a
locally-run web app started by a script.

It does **not** reason on its own. It spawns the `claude` or `gemini` CLI as a
constrained, no-tools reasoning function and owns everything around it: the UI,
the synced state of the project, the skill catalog, the safety guard, the policy
layer, persistence, and every side-effecting subprocess. **The CLI proposes;
Hermes validates and executes.**

Three conversation modes: **Converse** (read-only Q&A about the project),
**Create** (plan a change, then run it / hand over commands / generate
Terraform), and **Diagnose** (paste an error or log; get a step-by-step,
environment-customized resolution). Safety is paramount — **destructive
operations are structurally unreachable in v1**.

---

## 2. Current status

The **walking skeleton is complete** — all 13 planned build tasks are done,
committed in ~50 small commits on `main`, and pushed to
`github.com/vmishra/Cloud-Hermes`.

**Verified working:**
- `npm run typecheck` clean across the monorepo.
- `npm test` — 124 unit tests pass (18 files), all in `core` + `server` pure logic.
- `npm run build -w @cloud-hermes/web` builds (Tailwind 4 + OKLCH tokens compile).
- `npm run doctor` self-tests both `claude` and `gemini` (structured output confirmed).
- Converse mode and Create mode exercised end-to-end against the real `claude`
  CLI over the WebSocket — Create mode produced a correct VPC plan via the
  progressive skill-loading loop.

**Not runtime-tested (environment limitation, not a gap):** `gcloud` and
`terraform` are **not installed on this dev machine**. The gcloud executor,
state sync, the `run` execution path, and Terraform-plan classification are
structurally complete and unit-tested but have not been run end-to-end. They run
at runtime on a machine with the Google Cloud SDK.

**Deliberately deferred** (seams drawn; see §8): xterm.js terminal drawer (it is
a styled log for now), the ⌘K command palette, MCP skill enrichment, multi-user
accounts / shared workspaces, the end-of-conversation memory-extraction pass,
and motion/react spring animations (CSS transitions are used instead).

---

## 3. Architecture & design decisions (the load-bearing ones)

### The harness as a pure reasoning function
- The reasoning CLI is launched **non-interactive with all side-effecting tools
  disabled**, and is **stateless** — every turn is a fresh invocation with the
  fully reassembled prompt. Hermes is the single source of truth for what the
  model knows.
- Each provider is a **declarative profile** (`core/src/providers`) consumed by
  one shared spawn/parse engine (`server/src/harness`). New provider = new
  profile, not new code.
- Real CLI invocations:
  - Claude: `claude -p --output-format json --no-session-persistence --tools ""`,
    prompt on **stdin**.
  - Gemini: `gemini --output-format json -p ""`, prompt on **stdin**. (Do **not**
    use `--approval-mode plan` — it needs an experimental flag enabled.)
- Harness subprocesses run from a **clean scratch dir** (`<tmp>/cloud-hermes-harness`)
  so the CLIs do not pick up the repo as ambient context.

### Spawn discipline (`server/src/harness/spawn.ts`)
Every subprocess — reasoning CLI, `gcloud`, `terraform` — goes through one
boundary: argv-only with `shell: false`, explicit `cwd`, a **filtered env
allowlist** (children never inherit full `process.env`), a hard deadline with
`SIGTERM → SIGKILL` escalation, an `AbortSignal`, and a bounded stderr ring buffer.

### JSON is unreliable — deterministic salvage before re-ask
The CLI is asked for prose + one fenced ```json block. The parser
(`core/src/prompt/parser.ts`) runs: extract fenced block → balanced-object scan
(tries each `{`) → only then one structured re-ask → graceful error.

### The safety guard (`core/src/safety/`) — ordered, default-deny pipeline
Each gate can only reject or pass — never upgrade a verdict:
1. **Shell metacharacters** rejected outright.
2. **HARDLINE floor** — destructive verbs (`delete`, `destroy`, `remove-*`,
   `abandon-*`, `detach-*`, `clear-*`, `purge`) `BLOCKED` unconditionally. **No
   skill file, no `policy.json`, nothing data-driven can lift this.** It is code.
3. **Tokenize** — NFKC-normalize each token first (defeats fullwidth/zero-width
   obfuscation).
4. **Capability-table lookup** — a command runs only if a skill positively
   declares its `(service, resourceType, verb)`. Default-deny.
5. **Flag denylist** — per-capability denied flag prefixes.
6. **Classify** — `READ | CREATE | UPDATE`.
- **Re-classify after interpolation**: the model fills declared param slots,
  Hermes interpolates the vetted template, and the **final argv is re-run
  through the whole pipeline** — interpolation is never trusted.
- **Terraform is classified by its plan, not its HCL** (`tfplan.ts`): walk
  `resource_changes[].change.actions` for `delete`; an unparseable plan is BLOCKED.
- **One execution chokepoint** (`server/src/gcp/executor.ts` `executeClassified`).

### Guardian policy layer (`core/src/policy/`)
Per-workspace `policy.json` that **narrows** within the already-safe set
(allowed regions/zones/services/machine-types/CIDRs, approval mode). It can only
reject more, never permit more.

### Resource graph (`core/src/graph/`, `server/src/gcp/`)
State sync pulls the live project via read-only `gcloud` (itself classified by
the guard — no bypass), normalizes raw JSON into a typed node+edge graph. Powers
grounded answers, dependency-aware planning, and blast-radius on approval cards.
Slices fail independently (`unavailable` with a reason, never silently empty).
Live project = source of truth; graph = timestamped cache.

### Skill system (`packages/skills/`, `core/src/skills/`, `server/src/skills/`)
One markdown file per GCP service: machine-read YAML frontmatter + a body fed to
the CLI. The frontmatter `capabilities` block is the **single source** for both
prompt guidance AND the safety allowlist — no second copy. **Progressive
loading**: the prompt carries only the compact manifest index; the CLI requests
skills by id; Hermes resolves the dependency closure and folds bodies in,
bounded. A skill that fails schema validation is **excluded and fails the build**
— never loaded permissively.

### Other decisions
- **Operating loop**: Observe → Plan → Execute → Learn, surfaced in the UI.
- **Memory** (`core/src/memory/`, `server/src/memory/`): per-workspace
  `memory.md`; injected into prompts **context-fenced** with a provenance marker,
  fence delimiters stripped from content first so it can't forge the fence.
- **Conversations** persisted as markdown (source of truth), turns appended.
- **Audit log**: append-only JSON lines, written twice per mutation
  (classification + execution).
- **Secret redaction** (`core/src/safety/redact.ts`): every chunk bound for the
  terminal view or the model is redacted first.
- **Fail-closed approvals**: a disconnect / abort / new message denies every
  pending approval.
- **Provider abstraction**: `CloudProvider` seam for future AWS; GCP-only now.
- **Diagnose mode** (`server/src/diagnostics/`): a third conversation mode for
  guided troubleshooting. The operator pastes an error or log; the server
  gathers an `EnvironmentReport` (platform, node, gcloud install/auth/ADC/
  project, terraform, harnesses, workspace + sync staleness), pairs it with a
  troubleshooting knowledge base (`packages/skills/troubleshooting/`), and runs
  a `diagnose`-mode turn. The harness returns a `diagnosis` — ordered steps,
  each with a command **filled in with the operator's real values** and a verify
  line — or `clarifying_questions` if it needs a value the report does not have
  (the framing forbids placeholders: ask, never guess). Also reachable over REST
  (`POST /api/onboarding/diagnose`) so it works before a workspace exists. It is
  read-only guidance — the commands are for the operator to run; Hermes does not
  execute them.
- **Google Cloud MCP** (`server/src/mcp/`): Hermes — never the reasoning CLI —
  acts as a **read-only MCP client**, confined to the Observe stage. Opt-in via
  `CLOUD_HERMES_MCP_ENABLED=1`; off by default. When on, `syncState` adds a
  Cloud Asset Inventory slice so the resource graph covers the whole project
  (Execute stays gated by the classifier exactly as before). Read-only is *not*
  client-enforceable — `tools/list` returns every tool; it is enforced by IAM
  deny policies and, in practice, by scoping the operator's credentials to
  viewer roles. The client is disciplined (calls only a discovered read-only
  enumeration tool, honours `readOnlyHint`). Auth: ADC bearer token +
  `x-goog-user-project` header. Full decision and the live-validation caveat:
  `docs/MCP-INTEGRATION.md`.

---

## 4. Data flow

### A Converse turn
web composer → `user_message` over WS → server loads the workspace's
`graph.json` + `memory.md` → `summarizeGraph` + `fenceMemory` → `runTurn`
assembles the prompt (framing → memory → state → message) → spawns the harness
CLI → parses (with salvage) → `hermes_response` back over WS → rendered by
`ResponseView`. The turn is persisted to the conversation markdown.

### A Create turn
Same, but `runTurn` is given `buildSkillsSection`: the prompt carries the
manifest index; if the CLI replies `skill_request`, the server resolves the
dependency closure, folds skill bodies in, and re-runs (bounded). Result is a
`plan` (or `clarifying_questions`).

### Executing a plan
web sends `execute_plan` with `{steps, path}`:
- **commands** — `resolvePlanStep` → `interpolateGcloud` → `classifyGcloudCommand`
  → emit copyable command lines.
- **terraform** — `resolvePlanStep` → `interpolateTerraform` (from the catalog's
  templates) → emit HCL files.
- **run** — interpolate → **re-classify** → `enforcePolicy` → build a typed
  `ApprovalCard` with blast radius → `approval_required` over WS → pending
  Promise resolved by `approval_resolve` (fail-closed) → on approval,
  `executeClassified` streams `terminal` events → `execution_result` → re-sync
  the graph. Audited at classification and at execution.

---

## 5. Folder structure

```
Cloud-Hermes/
  packages/
    core/      Shared, mostly-pure, browser-safe (web imports it — NO node:
               imports reachable from src/index.ts). Holds:
               schemas/ (Zod: HermesResponse, resource graph, WS protocol,
                 workspace/onboarding), providers/ (harness contract + profiles),
                 prompt/ (framing, assembler, salvage parser), safety/
                 (classifier pipeline, hardline, redactor, tfplan), policy/
                 (Guardian policy + CIDR), graph/ (queries, blast radius,
                 summary), skills/ (frontmatter schema, parse, manifest,
                 interpolate), insights/ (checks + runner), memory/ (fence),
                 conversations/ (render), types.ts (error taxonomy, loop stages).
    server/    Fastify + WebSocket. Node-only. Holds:
               harness/ (spawn engine, provider, turn loop, self-test),
               gcp/ (guarded executor, state sync, raw-JSON normalizers),
               skills/ (filesystem catalog loader, dependency resolver),
               execution/ (plan resolution, blast radius, the 3 paths),
               workspace/ (workspace store), conversations/ + memory/ (markdown
               stores), audit/ (append-only log), onboarding/ (gcloud detect),
               routes/ (onboarding + workspace REST), ws/ (the WS handler),
               index.ts, config.ts.
    web/       Vite + React 19 + Tailwind 4. src/: App.tsx (phase router),
               WorkspaceShell, Conversation, ResponseView, DiagnosisView,
               InsightsView, ExecutionViews, PastConversationView;
               features/onboarding, features/history, features/memory;
               ui/ (atoms.tsx — the design atom library; ServiceIcon.tsx — GCP
               category icons; theme hook + toggle; voice input hook);
               api/client.ts (REST); ws/client.ts; index.css (the design
               token system). public/icons/gcp/ — official GCP category SVGs.
    skills/    The GCP skill catalog: services/*.md (vpc, subnet, compute-vm,
               firewall), templates/*.tf.tmpl, troubleshooting/common-errors.md
               (the diagnose-mode knowledge base), scripts/build-manifest.ts.
               manifest.json is generated + gitignored (server rebuilds it).
  scripts/     start.sh (the entrypoint), doctor.ts (preflight + harness
               self-test), spike-harness.ts (reliability spike).
  docs/        ARCHITECTURE.md (the deeper architecture write-up).
  workspaces/  Runtime data, gitignored: per-workspace dirs with workspace.json,
               state/graph.json, conversations/*.md, memory/memory.md, audit.log,
               optional policy.json.
  PLAN.md, learning.md   Local-only working references (gitignored). PLAN.md is
               the approved build plan; learning.md distilled patterns from a
               prior agent harness. The approved plan also lives at
               ~/.claude/plans/spicy-soaring-parnas.md.
```

---

## 6. Tech stack & conventions

- **TypeScript monorepo**, npm workspaces. Node 22+. ESM throughout.
  `verbatimModuleSyntax` + `isolatedModules` are on — use `import type` for
  type-only imports.
- **core**: zod + yaml. **server**: fastify, @fastify/websocket, ws, zod.
  **web**: react 19, vite 7, tailwind 4 (`@tailwindcss/vite`). **Tests**: vitest.
- `npm run dev` runs server (port 4317) + web (port 4316, proxies `/ws` +
  `/api`) via concurrently. `npm run typecheck`, `npm test`, `npm run doctor`.
- **Commits**: small, frequent, readable in isolation; messages end with the
  `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer. Commit + push at the
  end of each build task.
- **Design system** (`web/src/index.css`): a refined OKLCH token set — a `--bg`
  / `--surface` / `--elev-1..3` surface ramp, an `--ink`..`--ink-5` text ramp,
  `--info`/`--warning`/`--success`/`--danger`, code and terminal surfaces.
  **Light is the default**, dark is a sibling palette via `data-theme`; four
  accent palettes via `data-accent` (champagne is the default). Exposed to
  components as Tailwind utilities through `@theme inline`. The atom library
  (`ui/atoms.tsx`) is the component vocabulary: the winged-H `HermesMark`,
  `Wordmark`, the `LoopRail` (Observe→Plan→Execute→Learn), `StatusDot`, `Tag`,
  `Severity`, `Btn`, `CodeLine`, `Surface`. `ui/ServiceIcon.tsx` maps a resource
  kind / service / assetType to an official Google Cloud category icon. Geist /
  Geist Mono / Fraunces. Voice/tone: observational, sentence case, no
  exclamation marks, no emoji.

---

## 7. Notes for working in this codebase (gotchas already hit)

- **The Write tool interprets JSON escapes in `content`.** A regex literal
  containing `\n`, `\r`, or `\uXXXX` gets mangled (those are valid JSON escapes).
  Workarounds used: char classes (`[.]` not `\.`), `Set`s of code points instead
  of invisible-char regexes, Set-based metachar checks instead of regex. Regex
  escapes that are NOT valid JSON escapes (`\s \d \b \{ \}` etc.) pass through
  fine.
- **`core` must stay browser-safe.** The web imports `@cloud-hermes/core`, so
  nothing reachable from `core/src/index.ts` may import `node:*`. That is why
  skill *parsing* is in core but skill *filesystem loading* is in server.
- **`Omit<DiscriminatedUnion, K>` collapses to the common keys** — don't use it
  for "entry without id" helpers; spread the full union member instead.
- **Vite versions must dedupe** — vitest and the web app must resolve the same
  vite major (both on 7).
- Onboarding auth is **detect-and-guide**, not an interactive `gcloud auth`
  orchestration: the server checks gcloud state, the UI shows copyable commands
  and a re-check button.
- `resolvePlanStep` accepts a bare verb (e.g. `"create"`) when unambiguous, not
  only `"resourceType:verb"` — the harness tends to emit the bare form.

---

## 8. What's next (deferred, with seams drawn)

- xterm.js terminal drawer (currently a styled `<pre>` log).
- ⌘K command palette.
- The end-of-conversation memory-extraction pass (memory panel + injection exist).
- Multi-user accounts and shared team workspaces (data model is local-first but
  team-ready).
- The observability MCP servers (Logging, Monitoring, etc.) for richer Insights —
  the Asset Inventory MCP slice below is built; this is the follow-on.
- Expanding the skill catalog beyond vpc / subnet / compute-vm / firewall.
- Real `gcloud`/`terraform` end-to-end testing once the SDK is installed.
- motion/react spring animations per the design system.
