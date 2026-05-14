import { renderEnvironmentReport, type HarnessProvider } from '@cloud-hermes/core';
import { runTurn, type TurnResult } from '../harness/index';
import { gatherEnvironmentReport, type WorkspaceContext } from './report';

/**
 * The diagnose engine.
 *
 * Gathers the environment report, pairs it with the troubleshooting knowledge
 * base, and runs one diagnose-mode turn — the harness reasons about the pasted
 * error against the operator's *real* environment and returns a step-by-step
 * resolution with commands already filled in with the real project id and
 * account. It reuses the standard turn loop; diagnose mode is the framing plus
 * this grounding context, nothing more exotic.
 */

export interface DiagnoseInput {
  /** The error, log, or description the operator pasted in. */
  errorText: string;
  /** The troubleshooting knowledge base, loaded once at server boot. */
  knowledge: string;
  /** The workspace the diagnosis runs in, or null during onboarding. */
  workspace?: WorkspaceContext | null;
  signal?: AbortSignal;
}

export async function diagnose(
  provider: HarnessProvider,
  input: DiagnoseInput,
): Promise<TurnResult> {
  const report = await gatherEnvironmentReport(input.workspace ?? null);

  const context = [
    renderEnvironmentReport(report),
    '',
    '--- Troubleshooting knowledge base ---',
    '',
    input.knowledge.trim() === ''
      ? '(no knowledge base loaded — reason from the environment report and the error)'
      : input.knowledge,
  ].join('\n');

  return runTurn(provider, {
    mode: 'diagnose',
    userMessage: input.errorText,
    stateSummary: context,
    signal: input.signal,
  });
}
