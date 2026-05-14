import { HermesError, type EnvelopeFormat } from '@cloud-hermes/core';

/**
 * Output-envelope parsing.
 *
 * Each reasoning CLI wraps its response in a JSON envelope. This module reads
 * the model's response text out of that envelope; extracting the structured
 * `HermesResponse` from the text is a separate, later step. All envelope-shape
 * assumptions are isolated here, alongside the provider profiles.
 */

export interface ParsedEnvelope {
  /** The model's response text. */
  text: string;
  /** Provider-specific telemetry — cost, usage, session id. */
  providerMeta: Record<string, unknown>;
}

interface ClaudeEnvelope {
  result?: unknown;
  is_error?: unknown;
  total_cost_usd?: unknown;
  usage?: unknown;
  session_id?: unknown;
  duration_ms?: unknown;
}

function parseClaudeEnvelope(stdout: string): ParsedEnvelope {
  let raw: ClaudeEnvelope;
  try {
    raw = JSON.parse(stdout) as ClaudeEnvelope;
  } catch {
    throw new HermesError(
      'malformed-output',
      'Claude did not return a JSON envelope.',
      stdout.slice(0, 500),
    );
  }
  if (typeof raw.result !== 'string') {
    throw new HermesError(
      'malformed-output',
      'The Claude envelope had no result text.',
      stdout.slice(0, 500),
    );
  }
  return {
    text: raw.result,
    providerMeta: {
      totalCostUsd: raw.total_cost_usd,
      usage: raw.usage,
      sessionId: raw.session_id,
      isError: raw.is_error,
    },
  };
}

function parseGeminiEnvelope(stdout: string): ParsedEnvelope {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    throw new HermesError(
      'malformed-output',
      'Gemini did not return a JSON envelope.',
      stdout.slice(0, 500),
    );
  }
  // The Gemini envelope shape is pinned when the Gemini provider lands; until
  // then, read the response text from the fields it is known to use.
  const text =
    typeof raw['response'] === 'string'
      ? raw['response']
      : typeof raw['result'] === 'string'
        ? raw['result']
        : typeof raw['text'] === 'string'
          ? raw['text']
          : null;
  if (text === null) {
    throw new HermesError(
      'malformed-output',
      'The Gemini envelope had no response text.',
      stdout.slice(0, 500),
    );
  }
  return { text, providerMeta: { stats: raw['stats'] ?? raw['usage'] } };
}

export function parseEnvelope(format: EnvelopeFormat, stdout: string): ParsedEnvelope {
  switch (format) {
    case 'claude-json':
      return parseClaudeEnvelope(stdout);
    case 'gemini-json':
      return parseGeminiEnvelope(stdout);
  }
}
