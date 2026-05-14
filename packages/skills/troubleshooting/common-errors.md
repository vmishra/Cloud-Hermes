# Troubleshooting knowledge base

Reference knowledge for diagnose mode. Each entry is a class of error the
operator is likely to hit while setting up or running Cloud Hermes, with how to
recognize it and how to fix it. When you produce a diagnosis, fill every command
with the operator's real values from the environment report — never a
placeholder.

---

## gcloud is not installed or not on PATH

**Looks like:** `gcloud: command not found`, `'gcloud' is not recognized`, or
the environment report shows `gcloud: not installed`.

**Means:** the Google Cloud SDK is not installed, or its `bin` directory is not
on `PATH`.

**Fix:** install the SDK from https://cloud.google.com/sdk/docs/install. If it
is installed but not found, the SDK's `bin` directory needs to be on `PATH` —
on macOS/Linux that is usually `~/google-cloud-sdk/bin`; have the operator
confirm where they installed it and add it. Re-run the preflight afterward.

---

## gcloud is not authenticated

**Looks like:** `You do not currently have an active account selected`,
`Reauthentication required`, or the environment report shows
`account: none`.

**Means:** no user account is signed in to the gcloud CLI.

**Fix:** `gcloud auth login`. This opens a browser sign-in. After it completes,
the environment report's `account` should show the signed-in email.

---

## Application Default Credentials are missing or expired

**Looks like:** `Could not automatically determine credentials`,
`Reauthentication failed`, `invalid_grant`, `default credentials were not
found`, or the environment report shows `ADC: no`.

**Means:** Application Default Credentials — separate from `gcloud auth login` —
are not set up, or the cached token has expired. ADC is what state sync and the
MCP integration use.

**Fix:** `gcloud auth application-default login`. ADC is a distinct step from
signing in the account; both are needed. ADC tokens are short-lived, so if this
worked before and stopped, re-running the same command refreshes it.

---

## No project is configured, or the wrong project

**Looks like:** `The required property [project] is not currently set`,
`project … not found`, commands acting on a different project than expected, or
the environment report shows `configured project: unset`.

**Means:** gcloud has no active project, or it is set to a different project
than the workspace.

**Fix:** set it with `gcloud config set project PROJECT_ID`, using the
workspace's project id from the environment report. If the operator is unsure
which project they want, `gcloud projects list` shows the ones they can access.

---

## A required API is not enabled

**Looks like:** `SERVICE_DISABLED`, `API [compute.googleapis.com] not enabled`,
`has not been used in project … before or it is disabled`, or a sync slice
showing `unavailable` with an "API not enabled" reason.

**Means:** the Google Cloud API the operation needs is not enabled on the
project. Cloud Hermes does not enable APIs on its own.

**Fix:** enable it with `gcloud services enable SERVICE.googleapis.com`, using
the service named in the error and the project from the environment report. The
Compute Engine API is `compute.googleapis.com`; the error message names the one
that is needed. Enabling can take a minute to propagate.

---

## Permission denied

**Looks like:** `PERMISSION_DENIED`, `Required '…' permission`, `caller does not
have permission`, HTTP 403.

**Means:** the authenticated account lacks the IAM role for the operation. The
error names the permission; the role that grants it depends on the resource.

**Fix:** the project owner grants the account the needed role with
`gcloud projects add-iam-policy-binding PROJECT_ID --member="user:ACCOUNT" --role=ROLE`,
filling in the project and account from the environment report. For the
walking-skeleton services, the relevant roles are Compute Network Admin
(`roles/compute.networkAdmin`), Compute Instance Admin v1
(`roles/compute.instanceAdmin.v1`), and Compute Security Admin
(`roles/compute.securityAdmin`); read operations need the matching viewer roles.
If the operator is not the project owner, they need to ask whoever is.

---

## Quota exceeded

**Looks like:** `Quota exceeded`, `RESOURCE_EXHAUSTED`, `limit … exceeded`.

**Means:** the project has hit a quota for the resource being created.

**Fix:** this is not a Cloud Hermes problem to fix directly — the operator
either removes unused resources of that type, or requests a quota increase from
the Google Cloud console (`IAM & Admin → Quotas`). Name the specific quota from
the error so they can find it.

---

## Node.js is too old

**Looks like:** the preflight reporting a Node version below 22, or syntax
errors on startup.

**Means:** Cloud Hermes needs Node.js 22 or newer.

**Fix:** install a current Node.js from https://nodejs.org, or via a version
manager (`nvm install 22 && nvm use 22`). Re-run the preflight.

---

## No reasoning harness is ready

**Looks like:** the preflight or onboarding reporting that neither Claude Code
nor Gemini is available, or a harness installed but its self-test failing.

**Means:** Cloud Hermes needs the `claude` or `gemini` CLI installed *and*
authenticated. A harness that is installed but not signed in fails the
self-test.

**Fix:** install one — Claude Code from https://docs.claude.com/claude-code, or
the Gemini CLI — then run it once interactively to complete its sign-in. Re-run
the preflight; the self-test should then pass.

---

## The MCP integration shows an unavailable slice

**Looks like:** an `asset-inventory` sync slice marked `unavailable` with a
reason about ADC, an unreachable endpoint, or a missing tool.

**Means:** the optional Cloud Asset Inventory MCP enrichment could not run. It
is opt-in and read-only; the rest of the graph is unaffected.

**Fix:** depends on the reason. "No ADC token" → run
`gcloud auth application-default login`. A permission error → the account needs
`roles/mcp.toolUser` on the project, and viewer roles for the resources being
read. If the operator did not intend to use it, unset `CLOUD_HERMES_MCP_ENABLED`.

---

## When the pasted error is not enough

If the operator pastes a short message without context, the single most useful
thing to ask for is the **exact command they ran and its complete output**.
A truncated error rarely names its own cause; the full output usually does.
