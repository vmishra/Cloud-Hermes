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
 * Assembles the prompt, invokes the harness, parses the response. A parse
 * failure spends exactly one structured re-ask — the deterministic salvage
 * already ran inside the parser. In create mode, a `skill_request` triggers
 * progressive loading: the requested skills (and their dependency closure) are
 * folded into the prompt and the turn is re-run, bounded so the harness cannot
 * loop forever asking for skills.
 */

export interface TurnInput {
  mode: ConversationMode;
  userMessage: string;
  /** The context-fenced "user memory" block — recalled operator preferences. */
  userMemory?: string;
  /** A compact, deterministic summary of the workspace's synced project state. */
  stateSummary?: string;
  /**
   * Builds the prompt's skills section from the cumulative set of requested
   * skill ids — wired to the skill catalog by the caller. Its presence enables
   * create-mode progressive skill loading.
   */
  buildSkillsSection?: (requestedSkillIds: string[]) => string;
  signal?: AbortSignal;
}

export type TurnResult =
  | { ok: true; response: HermesResponse; salvaged: boolean; durationMs: number }
  | { ok: false; code: string; message: string; detail: string };

const REASK_INSTRUCTION = `Your previous reply could not be parsed. Send your response
again now: a short line of prose, then exactly one fenced \`\`\`json block — and
nothing after it — matching one of the documented shapes. Do not apologise; just
re-send the response.`;

const MAX_SKILL_ROUNDS = 3;

type Attempt =
  | { ok: true; response: HermesResponse; salvaged: boolean; durationMs: number }
  | { ok: false; kind: 'cli' | 'parse'; code: string; detail: string; durationMs: number };

async function invokeAndParse(
  provider: HarnessProvider,
  prompt: string,
  signal?: AbortSignal,
): Promise<Attempt> {
  try {
    const result = await provider.invoke({ prompt, signal });
    const parsed = parseHermesResponse(result.text);
    if (parsed.ok) {
      return {
        ok: true,
        response: parsed.response,
        salvaged: parsed.salvaged,
        durationMs: result.durationMs,
      };
    }
    return { ok: false, kind: 'parse', code: parsed.error, detail: parsed.detail, durationMs: result.durationMs };
  } catch (err) {
    if (err instanceof HermesError) {
      return { ok: false, kind: 'cli', code: err.code, detail: err.detail ?? '', durationMs: 0 };
    }
    throw err;
  }
}

export async function runTurn(
  provider: HarnessProvider,
  input: TurnInput,
): Promise<TurnResult> {
  const systemFraming = buildSystemFraming(input.mode);
  const requestedSkillIds = new Set<string>();
  let totalMs = 0;

  for (let round = 0; round <= MAX_SKILL_ROUNDS; round += 1) {
    const skillsSection = input.buildSkillsSection
      ? input.buildSkillsSection([...requestedSkillIds])
      : undefined;

    const prompt = assemblePrompt({
      systemFraming,
      userMemory: input.userMemory,
      stateSummary: input.stateSummary,
      skills: skillsSection,
      userMessage: input.userMessage,
    });

    let attempt = await invokeAndParse(provider, prompt, input.signal);
    totalMs += attempt.durationMs;

    // A parse failure — and only a parse failure — earns one structured re-ask.
    if (!attempt.ok && attempt.kind === 'parse') {
      const reaskPrompt = assemblePrompt({
        systemFraming,
        userMemory: input.userMemory,
        stateSummary: input.stateSummary,
        skills: skillsSection,
        history: `The user asked:\n${input.userMessage}\n\nYou replied with something that could not be parsed.`,
        userMessage: REASK_INSTRUCTION,
      });
      attempt = await invokeAndParse(provider, reaskPrompt, input.signal);
      totalMs += attempt.durationMs;
    }

    if (!attempt.ok) {
      return {
        ok: false,
        code: attempt.code,
        message:
          attempt.kind === 'cli'
            ? 'The harness could not complete the turn.'
            : 'The harness did not return a valid response after a retry.',
        detail: attempt.detail,
      };
    }

    const response = attempt.response;
    if (
      response.kind === 'skill_request' &&
      input.buildSkillsSection !== undefined &&
      round < MAX_SKILL_ROUNDS
    ) {
      for (const id of response.skills) requestedSkillIds.add(id);
      continue;
    }

    return { ok: true, response, salvaged: attempt.salvaged, durationMs: totalMs };
  }

  return {
    ok: false,
    code: 'skill-loop-exhausted',
    message: 'The harness kept requesting skills without producing a plan or answer.',
    detail: '',
  };
}
