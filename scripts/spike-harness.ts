/**
 * Harness reliability spike.
 *
 * Run with `npx tsx scripts/spike-harness.ts [runs] [provider]`.
 *
 * The whole architecture rests on the reasoning CLI behaving as a pure
 * function that reliably returns parseable structured output. This spike
 * exercises that contract directly: it asks the provider, N times, for prose
 * plus a single fenced ```json block, and reports how often the block extracts
 * and validates — plus latency and cost. It is a smoke test, not a gate.
 */
import { z } from 'zod';
import { createProviderById } from '../packages/server/src/harness/index';
import type { ProviderId } from '@cloud-hermes/core';

const runs = Number(process.argv[2] ?? 12);
const providerId = (process.argv[3] ?? 'claude') as ProviderId;

/** A representative structured-response shape. */
const SpikeSchema = z.object({
  kind: z.literal('answer'),
  markdown: z.string().min(1),
  confidence: z.enum(['low', 'medium', 'high']),
});

const PROMPT = [
  'You are the reasoning core of Cloud Hermes, a tool for Google Cloud.',
  'You have no tools. You only reason and respond.',
  '',
  'Answer the question below. Respond with one short sentence of prose, then a',
  'single fenced ```json block — and nothing after it — matching exactly:',
  '  { "kind": "answer", "markdown": <string>, "confidence": "low" | "medium" | "high" }',
  '',
  'Question: which Google Cloud service runs containers without managing servers?',
].join('\n');

function extractFencedJson(text: string): unknown | null {
  const match = text.match(/```json\s*([\s\S]*?)```/i);
  if (!match || match[1] === undefined) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const provider = createProviderById(providerId);
  process.stdout.write(
    `\nHarness spike — ${provider.profile.displayName}, ${runs} run(s)\n\n`,
  );

  let ok = 0;
  let totalMs = 0;
  let totalCost = 0;

  for (let i = 0; i < runs; i += 1) {
    try {
      const result = await provider.invoke({ prompt: PROMPT, timeoutMs: 90_000 });
      totalMs += result.durationMs;
      const cost = Number(result.providerMeta?.['totalCostUsd'] ?? 0);
      if (Number.isFinite(cost)) totalCost += cost;

      const parsed = SpikeSchema.safeParse(extractFencedJson(result.text));
      if (parsed.success) {
        ok += 1;
        process.stdout.write('  .');
      } else {
        process.stdout.write('  x');
      }
    } catch (err) {
      process.stdout.write('  !');
      if (i === 0) {
        process.stdout.write(`\n  first run failed: ${err instanceof Error ? err.message : String(err)}\n`);
      }
    }
  }

  process.stdout.write('\n\n');
  process.stdout.write(`  structured-output success : ${ok}/${runs}\n`);
  process.stdout.write(`  average latency           : ${runs ? Math.round(totalMs / runs) : 0} ms\n`);
  process.stdout.write(`  average cost              : $${runs ? (totalCost / runs).toFixed(5) : '0'}\n\n`);

  process.exit(ok === runs ? 0 : 1);
}

void main();
