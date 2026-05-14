import { z } from 'zod';
import { HermesResponse, PlanStep } from './hermes';

/**
 * The WebSocket protocol between the web client and the server. Defined here,
 * in the shared core package, so both ends bind to one contract.
 */

export const ConversationMode = z.enum(['create', 'converse', 'diagnose']);

/** The source subprocess behind a terminal stream event. */
export const TerminalSource = z.enum(['harness', 'gcloud', 'terraform', 'auth']);

/** The execution path chosen for a plan: run it, hand over the commands, or
 *  generate Terraform. */
export const ExecutionPath = z.enum(['run', 'commands', 'terraform']);

/**
 * The single approval card. Every gate's finding — the classifier verdict, the
 * policy layer, the blast radius — folds into one of these, and the human
 * approves or denies exactly this. The card cannot exist without a blast
 * radius: it is a required field, not an empty state.
 */
export const ApprovalCard = z.object({
  approvalId: z.string(),
  /** The exact argv that will run if approved. */
  argv: z.array(z.string()),
  classification: z.enum(['CREATE', 'UPDATE']),
  /** Which classifier gate decided. */
  decidedBy: z.string(),
  reason: z.string(),
  /** The resources this change touches, by name — the blast radius. */
  blastRadius: z.array(z.string()),
  /** Notes carried from the policy layer. */
  policyNotes: z.array(z.string()),
});

/** One interpolated command from a plan step, for the copyable-commands path. */
export const ExecutionCommand = z.object({
  skillId: z.string(),
  capability: z.string(),
  /** The interpolated command line, or null when it could not be produced. */
  command: z.string().nullable(),
  classification: z.string(),
  ok: z.boolean(),
  detail: z.string(),
});

/** One generated Terraform file, for the Terraform path. */
export const TerraformFile = z.object({
  name: z.string(),
  hcl: z.string(),
  /** Template slots that had no parameter — a visible templating bug. */
  unresolved: z.array(z.string()),
});

/** Messages the web client sends to the server. */
export const ClientMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({
    type: z.literal('user_message'),
    conversationId: z.string(),
    /** The workspace this conversation belongs to — its synced project state
     *  is what the turn is grounded in. */
    workspaceId: z.string(),
    mode: ConversationMode,
    text: z.string(),
  }),
  z.object({
    type: z.literal('execute_plan'),
    conversationId: z.string(),
    workspaceId: z.string(),
    steps: z.array(PlanStep),
    path: ExecutionPath,
  }),
  z.object({
    type: z.literal('approval_resolve'),
    approvalId: z.string(),
    decision: z.enum(['approved', 'denied']),
  }),
  z.object({ type: z.literal('abort'), conversationId: z.string() }),
]);

/** Messages the server pushes to the web client. */
export const ServerMessage = z.discriminatedUnion('type', [
  z.object({ type: z.literal('pong') }),
  z.object({ type: z.literal('connected'), serverVersion: z.string() }),
  /**
   * A chunk of subprocess output for the live terminal view. Every chunk is
   * passed through the secret redactor before it reaches the wire.
   */
  z.object({
    type: z.literal('terminal'),
    commandId: z.string(),
    source: TerminalSource,
    stream: z.enum(['stdout', 'stderr']),
    chunk: z.string(),
    classification: z.string().optional(),
  }),
  z.object({
    type: z.literal('text_delta'),
    conversationId: z.string(),
    delta: z.string(),
  }),
  z.object({
    type: z.literal('hermes_response'),
    conversationId: z.string(),
    response: HermesResponse,
  }),
  z.object({
    type: z.literal('commands'),
    conversationId: z.string(),
    commands: z.array(ExecutionCommand),
  }),
  z.object({
    type: z.literal('terraform'),
    conversationId: z.string(),
    files: z.array(TerraformFile),
  }),
  z.object({
    type: z.literal('approval_required'),
    conversationId: z.string(),
    card: ApprovalCard,
  }),
  z.object({
    type: z.literal('execution_result'),
    conversationId: z.string(),
    approvalId: z.string(),
    ok: z.boolean(),
    summary: z.string(),
  }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type ConversationMode = z.infer<typeof ConversationMode>;
export type TerminalSource = z.infer<typeof TerminalSource>;
export type ExecutionPath = z.infer<typeof ExecutionPath>;
export type ApprovalCard = z.infer<typeof ApprovalCard>;
export type ExecutionCommand = z.infer<typeof ExecutionCommand>;
export type TerraformFile = z.infer<typeof TerraformFile>;
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ServerMessage = z.infer<typeof ServerMessage>;
