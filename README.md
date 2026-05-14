# Cloud Hermes

A conversational orchestration layer for Google Cloud.

Cloud Hermes lets cloud architects and DevOps teams talk to their Google Cloud
project — by voice or text — to understand what exists and to create or update
infrastructure. It plans before it acts, grounds itself in official GCP best
practices through a skill system, syncs the real state of the project before
every change, and keeps destructive operations structurally out of reach.

Cloud work today means moving between documentation, the console, `gcloud`
incantations, and Terraform. Hermes collapses that into a conversation, and
keeps a human in the loop for everything that touches the project.

---

## The operating loop

Hermes runs a named four-stage loop, and the interface always shows which stage
it is in:

- **Observe** — sync the live state of the project into a resource graph.
- **Plan** — clarify the request, load the relevant skills, produce a plan.
- **Execute** — validate through the safety guard and policy layer, then run.
- **Learn** — record durable preferences into per-workspace memory.

Converse mode is the Observe-to-answer path. Create mode runs the full loop.

## Two modes

- **Converse** — read-only questions about the project: subnet ranges, running
  instances, firewall rules, what is attached to what. Every answer is grounded
  in synced state and cites the resource it rests on.
- **Create** — Hermes plans a change, asks clarifying questions, loads skills as
  it needs them, and produces a plan you can act on three ways:
  1. **Run** the `gcloud` commands directly, behind a blast-radius approval card.
  2. Take the **commands** and run them yourself.
  3. **Generate Terraform** to review, edit, and download.

## Safety

Destructive operations are not supported in this version, and that is enforced
structurally, not by convention:

- The safety guard is a **default-deny, ordered pipeline**. A command is taken
  as an argument vector, never a string — there is no shell to inject into.
- Beneath everything sits a **hardline floor**: destructive verbs are blocked
  unconditionally, and no skill file or policy setting can lift that.
- A command is only permitted if a skill's capability table positively declares
  it. The model fills declared parameter slots; Hermes interpolates the vetted
  template and **re-classifies the final command** — interpolation is never
  trusted.
- Terraform is judged by its **plan**, not its source: a `terraform apply` that
  would destroy or replace a resource is blocked even though the verb is `apply`.
- Every mutation is previewed with its blast radius, confirmed by a human, and
  written twice to an append-only audit log — once at classification, once at
  execution.

## How it works

Hermes is a harness. It does not reason on its own — it spawns the `claude` or
`gemini` CLI as a constrained, no-tools reasoning function and owns everything
around it: the interface, the synced resource graph, the skill catalog, the
safety guard, the policy layer, conversation history, per-workspace memory, and
every side-effecting subprocess. The reasoning CLI proposes; Hermes validates
and executes.

It is a TypeScript monorepo: a shared `core` package of types, schemas, and pure
logic; a Fastify + WebSocket `server`; a Vite + React `web` app; and a `skills`
package — the Google Cloud skill catalog. See
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full picture.

## Quick start

Requirements:

- Node.js 22 or newer
- One reasoning harness — the [Claude Code](https://docs.claude.com/claude-code)
  CLI or the Gemini CLI — installed and authenticated
- The [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`),
  authenticated against the project you want to manage
- Terraform, optionally, to verify generated plans

```sh
./scripts/start.sh
```

The start script installs dependencies, runs the environment preflight, and
launches the server and the web app. Open the web app, and onboarding walks you
through connecting a project: it detects what is installed, guides you through
authenticating `gcloud`, and creates a workspace linked to one project.

Run the preflight on its own at any time:

```sh
npm run doctor
```

## Try it

In a fresh workspace:

- Ask, in **Converse** mode, _"what networks does this project have, and what
  are their subnet ranges?"_ — Hermes answers from the synced graph.
- Click **Review project** for an evidence-linked best-practice review.
- Switch to **Create** mode and say _"create a custom-mode VPC named core"_.
  Hermes loads the VPC skill, produces a plan, and offers the three paths. Pick
  **Generate Terraform** to see the HCL, or **Run** to see the blast-radius
  approval card before anything touches the project.

## Project layout

```
packages/
  core/      shared types, Zod schemas, the safety guard, the resource graph,
             the skill model, prompt assembly — pure, no I/O
  server/    Fastify + WebSocket; the harness, gcloud executor, state sync,
             workspace and conversation stores, the execution paths
  web/       Vite + React; onboarding, the conversation surface, the views
  skills/    the Google Cloud skill catalog — one markdown file per service
scripts/
  start.sh   the one-script entrypoint
  doctor.ts  the environment preflight
```

## Status

Early development, following a walking-skeleton plan: a thin end-to-end slice
first — workspace creation, GCP authentication, state sync, Converse mode, and
Create mode for VPC networks, subnets, Compute Engine VMs, and firewall rules —
with the skill catalog and the surface expanding from there. The architecture
carries a provider abstraction so other clouds can be added later; this version
is Google Cloud only.

## Contributing

A skill is not just documentation — its capability table is part of the safety
guard's allowlist. Adding a skill expands what commands Hermes will permit, so a
skill pull request is reviewed as a privilege change. Skill frontmatter is
schema-validated, and a skill that does not validate fails the build rather than
loading permissively.

## License

MIT — see [LICENSE](./LICENSE).
