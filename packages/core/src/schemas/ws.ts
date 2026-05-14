import { z } from 'zod';
import { HermesResponse } from './hermes';

/**
 * The WebSocket protocol between the web client and the server. Defined here,
 * in the shared core package, so both ends bind to one contract.
 */

export const ConversationMode = z.enum(['create', 'converse']);

/** The source subprocess behind a terminal stream event. */
export const TerminalSource = z.enum(['harness', 'gcloud', 'terraform', 'auth']);

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
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);

export type ConversationMode = z.infer<typeof ConversationMode>;
export type TerminalSource = z.infer<typeof TerminalSource>;
export type ClientMessage = z.infer<typeof ClientMessage>;
export type ServerMessage = z.infer<typeof ServerMessage>;
