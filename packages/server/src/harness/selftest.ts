import { HermesError, parseHermesResponse, type HarnessProvider } from '@cloud-hermes/core';

/**
 * Provider self-test.
 *
 * Presence of the binary is not enough. A CLI that is installed but not
 * authenticated, or one whose output shape has drifted between versions, looks
 * fine to a `--version` check and then fails silently at parse time. The
 * self-test runs a trivial structured query and confirms the response actually
 * parses and validates — the real readiness signal.
 */

const SELF_TEST_PROMPT = [
  'You are the reasoning core of Cloud Hermes. You have no tools.',
  '',
  'This is a self-test. Reply with one short line of prose, then exactly one',
  'fenced ```json block — and nothing after it — matching exactly:',
  '  { "kind": "answer", "markdown": "ready", "citations": [] }',
].join('\n');

export interface SelfTestResult {
  ok: boolean;
  /** A human-readable line describing the outcome. */
  detail: string;
  durationMs?: number;
}

export async function selfTestProvider(provider: HarnessProvider): Promise<SelfTestResult> {
  try {
    const result = await provider.invoke({ prompt: SELF_TEST_PROMPT, timeoutMs: 60_000 });
    const parsed = parseHermesResponse(result.text);
    if (!parsed.ok) {
      return {
        ok: false,
        detail: `responded, but the output did not parse (${parsed.error})`,
        durationMs: result.durationMs,
      };
    }
    if (parsed.response.kind !== 'answer') {
      return {
        ok: false,
        detail: `responded with '${parsed.response.kind}', expected 'answer'`,
        durationMs: result.durationMs,
      };
    }
    return {
      ok: true,
      detail: `structured output confirmed`,
      durationMs: result.durationMs,
    };
  } catch (err) {
    if (err instanceof HermesError) {
      return { ok: false, detail: `${err.code} — ${err.message}` };
    }
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}
