import { z } from 'zod';

/**
 * The structured response contract for the harness CLI.
 *
 * The CLI (`claude -p` / `gemini -p`) is a pure reasoning function: it returns
 * prose plus a single fenced ```json block matching this discriminated union.
 * Hermes extracts and validates it — the CLI proposes, Hermes executes.
 */

/** A single clarifying question Hermes asks before it can plan. */
export const ClarifyingQuestion = z.object({
  id: z.string(),
  question: z.string(),
  /** Optional suggested answers; the user may always answer freely. */
  options: z.array(z.string()).optional(),
});

export const ClarifyingQuestionsResponse = z.object({
  kind: z.literal('clarifying_questions'),
  questions: z.array(ClarifyingQuestion).min(1),
});

/**
 * One step of a proposed plan: a skill capability invoked with concrete params.
 * The CLI never writes a command string — it fills declared param slots, and
 * Hermes interpolates the vetted template.
 */
export const PlanStep = z.object({
  skillId: z.string(),
  /** `<resourceType>:<verb>` — must match a capability declared in the skill. */
  capability: z.string(),
  params: z.record(z.string(), z.string()),
  rationale: z.string(),
});

export const PlanResponse = z.object({
  kind: z.literal('plan'),
  summary: z.string(),
  steps: z.array(PlanStep).min(1),
});

/** An evidence-linked citation pointing into the resource graph. */
export const Citation = z.object({
  label: z.string(),
  /** A resource-graph node id, when the claim is grounded in synced state. */
  resourceId: z.string().optional(),
  /** The specific field the claim rests on. */
  field: z.string().optional(),
});

export const AnswerResponse = z.object({
  kind: z.literal('answer'),
  markdown: z.string(),
  citations: z.array(Citation).default([]),
});

/** Progressive loading: the CLI asks for skills it needs before it can plan. */
export const SkillRequestResponse = z.object({
  kind: z.literal('skill_request'),
  skills: z.array(z.string()).min(1),
  reason: z.string().optional(),
});

export const HermesResponse = z.discriminatedUnion('kind', [
  ClarifyingQuestionsResponse,
  PlanResponse,
  AnswerResponse,
  SkillRequestResponse,
]);

export type ClarifyingQuestion = z.infer<typeof ClarifyingQuestion>;
export type ClarifyingQuestionsResponse = z.infer<typeof ClarifyingQuestionsResponse>;
export type PlanStep = z.infer<typeof PlanStep>;
export type PlanResponse = z.infer<typeof PlanResponse>;
export type Citation = z.infer<typeof Citation>;
export type AnswerResponse = z.infer<typeof AnswerResponse>;
export type SkillRequestResponse = z.infer<typeof SkillRequestResponse>;
export type HermesResponse = z.infer<typeof HermesResponse>;
export type HermesResponseKind = HermesResponse['kind'];
