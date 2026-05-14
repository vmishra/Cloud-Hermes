import {
  assemblePrompt,
  buildSystemFraming,
  parseHermesResponse,
  HermesError,
  type ConversationMode,
  type HarnessProvider,
  type HermesResponse,
} from '@cloud-hermes/core';

/**
 * One reasoning turn.
 *
 * Assembles the prompt, invokes the harness, and parses the response. The
 * deterministic salvage path inside the parser runs first; only when it fails
 * does this spend a single structured re-ask. A second failure resolves to a
 * graceful error — there is no retry loop.
 *
 * Context (memory, skills, project state, history) is threaded in by later
 * build steps; for now a turn is system framing plus the user's message.
 */

export interface TurnInput {
  mode: ConversationMode;
  userMessage: string;
  signal?: AbortSignal;
}

export type TurnResult =
  | { ok: true; response: HermesResponse; salvaged: boolean; durationMs: number }
  | { ok: false; code: string; message: string; detail: string };

const REASK_INSTRUCTION = `Your previous reply could not be parsed. Send your response
again now: a short line of prose, then exactly one fenced \`\`\`json block — and
nothing after it — matching one of the documented shapes. Do not apologise; just
re-send the response.`;

export async function runTurn(
  provider: HarnessProvider,
  input: TurnInput,
): Promise<TurnResult> {
  const systemFraming = buildSystemFraming(input.mode);

  try {
    const firstPrompt = assemblePrompt({ systemFraming, userMessage: input.userMessage });
    const first = await provider.invoke({ prompt: firstPrompt, signal: input.signal });

    const parsed = parseHermesResponse(first.text);
    if (parsed.ok) {
      return {
        ok: true,
        response: parsed.response,
        salvaged: parsed.salvaged,
        durationMs: first.durationMs,
      };
    }

    // Salvage failed deterministically — spend exactly one structured re-ask.
    const reaskPrompt = assemblePrompt({
      systemFraming,
      history: `The user asked:\n${input.userMessage}\n\nYou replied with something that could not be parsed.`,
      userMessage: REASK_INSTRUCTION,
    });
    const second = await provider.invoke({ prompt: reaskPrompt, signal: input.signal });

    const reparsed = parseHermesResponse(second.text);
    if (reparsed.ok) {
      return {
        ok: true,
        response: reparsed.response,
        salvaged: reparsed.salvaged,
        durationMs: first.durationMs + second.durationMs,
      };
    }

    return {
      ok: false,
      code: reparsed.error,
      message: 'The harness did not return a valid response after a retry.',
      detail: reparsed.detail,
    };
  } catch (err) {
    if (err instanceof HermesError) {
      return { ok: false, code: err.code, message: err.message, detail: err.detail ?? '' };
    }
    throw err;
  }
}
