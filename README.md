# Cloud Hermes

A conversational orchestration layer for Google Cloud.

Cloud Hermes lets cloud architects and DevOps teams talk to their Google Cloud
project — by voice or text — to understand what exists and to create or update
infrastructure. It plans before it acts, grounds itself in official GCP best
practices through a skill system, syncs the real state of the project before
every change, and keeps destructive operations structurally out of reach.

Cloud work today means moving between documentation, the console, `gcloud`
incantations, and Terraform. Hermes collapses that into a conversation.

---

## How it works

Cloud Hermes is a harness. It does not reason on its own — it spawns the
`claude` or `gemini` CLI as a constrained, no-tools reasoning function and owns
everything around it: the interface, the live state of your project, the skill
catalog, the safety guard, and every side-effecting command.

The product runs a four-stage loop:

- **Observe** — sync live GCP state into a resource graph.
- **Plan** — clarify the request, load the relevant skills, produce a plan.
- **Execute** — validate through the safety guard and policy layer, then run.
- **Learn** — record durable preferences into per-workspace memory.

### Two modes

- **Converse** — read-only questions about the project: subnet ranges, running
  instances, firewall rules, what is attached to what.
- **Create** — Hermes plans a change, asks clarifying questions, and offers
  three execution paths: run the `gcloud` commands directly, hand you the
  commands to run yourself, or generate Terraform.

### Safety

Destructive operations are not supported in this version. The safety guard is a
default-deny, ordered pipeline with a hardline floor that no skill file or
policy setting can lift. Every mutation is previewed with its blast radius and
confirmed by a human before it runs.

---

## Status

Early development. The build is following a walking-skeleton plan: a thin
end-to-end slice first — workspace creation, GCP authentication, state sync,
Converse mode, and Create mode for a small set of services — then the skill
catalog expands from there.

## Requirements

- Node.js 22 or newer
- One reasoning harness: the [Claude Code](https://docs.claude.com/claude-code)
  CLI or the Gemini CLI
- The [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (`gcloud`),
  authenticated against the project you want to manage
- Terraform, optionally, to verify generated plans

Run `npm run doctor` to check your environment.

## License

MIT — see [LICENSE](./LICENSE).
