import { z } from 'zod';

/**
 * Workspace and onboarding contracts.
 *
 * A workspace is the unit Cloud Hermes operates in: one workspace is linked to
 * exactly one Google Cloud project and one reasoning harness. Onboarding
 * creates the first workspace once the environment is ready.
 */

/** The reasoning harness a workspace uses. Mirrors `ProviderId` from the
 *  providers module — the two must stay in step. */
export const HarnessId = z.enum(['claude', 'gemini']);

export const Workspace = z.object({
  id: z.string(),
  name: z.string(),
  /** The Google Cloud project this workspace manages. */
  projectId: z.string(),
  harness: HarnessId,
  /** ISO-8601 creation timestamp. */
  createdAt: z.string(),
});

/** The state of the gcloud CLI, as onboarding sees it. */
export const GcloudStatus = z.object({
  installed: z.boolean(),
  /** The active authenticated account, or null if none. */
  account: z.string().nullable(),
  /** Whether Application Default Credentials are available. */
  adc: z.boolean(),
  /** The currently-configured project, or null. */
  project: z.string().nullable(),
});

/** The state of one reasoning harness. */
export const HarnessStatus = z.object({
  id: HarnessId,
  installed: z.boolean(),
  /** True when the harness is installed and its self-test passed. */
  ready: z.boolean(),
  detail: z.string(),
});

/** Everything the web app needs on load to decide whether to show onboarding. */
export const OnboardingStatus = z.object({
  gcloud: GcloudStatus,
  harnesses: z.array(HarnessStatus),
  workspaces: z.array(Workspace),
});

export type HarnessId = z.infer<typeof HarnessId>;
export type Workspace = z.infer<typeof Workspace>;
export type GcloudStatus = z.infer<typeof GcloudStatus>;
export type HarnessStatus = z.infer<typeof HarnessStatus>;
export type OnboardingStatus = z.infer<typeof OnboardingStatus>;
