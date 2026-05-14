import { z } from 'zod';

/**
 * Skill frontmatter schema.
 *
 * Every skill is one markdown file: machine-read YAML frontmatter, plus a body
 * fed to the reasoning CLI. The `capabilities` block is the single source
 * consulted by two consumers — the prompt assembler reads its templates for
 * guidance, and the safety guard derives its allowlist from it. There is no
 * second copy, and it is enforced by this schema.
 */

export const SkillParam = z.object({
  name: z.string(),
  description: z.string().optional(),
  /** A regular expression the param value must fully match. */
  pattern: z.string().optional(),
  /** The exact set of allowed values. */
  oneOf: z.array(z.string()).optional(),
});

export const SkillCapability = z.object({
  /** The gcloud resource type — nested group names space-joined, e.g.
   *  `networks subnets`. */
  resourceType: z.string(),
  verb: z.string(),
  classification: z.enum(['READ', 'CREATE', 'UPDATE']),
  /** A gcloud command template with `{placeholder}` slots Hermes interpolates. */
  gcloudTemplate: z.string(),
  requiredParams: z.array(SkillParam).default([]),
  /** A Terraform template file name, under the skills package's templates dir. */
  terraformTemplate: z.string().optional(),
  /** Flag-name prefixes denied for this capability, e.g. `--clear-`, `--no-`. */
  flagDenylist: z.array(z.string()).default([]),
});

export const SkillFrontmatter = z.object({
  /** Stable skill id — lowercase, used in plans and skill requests. */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  displayName: z.string(),
  /** Semantic version of the skill — bumped when its guidance or capabilities change. */
  version: z.string().default('1.0.0'),
  /** A concise description for the manifest index — a router, not docs. */
  description: z.string().min(1).max(200),
  /**
   * Explicit trigger phrases — "create a VPC", "subnet range", "open a port" —
   * that help the reasoning CLI pick this skill from the manifest index.
   */
  triggers: z.array(z.string()).default([]),
  /** The gcloud service group this skill covers, e.g. `compute`. */
  service: z.string(),
  /** Skill ids that should be co-loaded with this one. */
  dependsOn: z.array(z.string()).default([]),
  /** Provenance — official Google Cloud documentation URLs. */
  docs: z.array(z.string()).default([]),
  capabilities: z.array(SkillCapability).min(1),
});

export type SkillParam = z.infer<typeof SkillParam>;
export type SkillCapability = z.infer<typeof SkillCapability>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatter>;
