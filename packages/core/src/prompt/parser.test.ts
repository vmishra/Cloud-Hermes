import { describe, it, expect } from 'vitest';
import { parseHermesResponse, extractFencedJson, extractBalancedJson } from './parser';

const answer = (markdown: string): string =>
  JSON.stringify({ kind: 'answer', markdown, citations: [] });

describe('extractFencedJson', () => {
  it('pulls the body of a ```json fence', () => {
    expect(extractFencedJson('prose\n```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('returns null when there is no fence', () => {
    expect(extractFencedJson('just prose, no block')).toBeNull();
  });
});

describe('extractBalancedJson', () => {
  it('finds the first balanced object', () => {
    expect(extractBalancedJson('text {"a":{"b":1}} trailing')).toBe('{"a":{"b":1}}');
  });

  it('ignores braces inside strings', () => {
    const input = 'x {"markdown":"a } b { c","kind":"answer"} y';
    expect(extractBalancedJson(input)).toBe('{"markdown":"a } b { c","kind":"answer"}');
  });

  it('returns null when no object is balanced', () => {
    expect(extractBalancedJson('{ unterminated')).toBeNull();
    expect(extractBalancedJson('no braces here')).toBeNull();
  });
});

describe('parseHermesResponse', () => {
  it('parses the happy fenced path without salvaging', () => {
    const outcome = parseHermesResponse(`Here is the answer.\n\n\`\`\`json\n${answer('Cloud Run')}\n\`\`\``);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.salvaged).toBe(false);
      expect(outcome.response.kind).toBe('answer');
    }
  });

  it('salvages a bare object when the fence is missing', () => {
    const outcome = parseHermesResponse(`No fence here, sorry.\n${answer('Cloud Run')}`);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.salvaged).toBe(true);
      expect(outcome.response.kind).toBe('answer');
    }
  });

  it('salvages when the fenced block is malformed but a balanced object follows', () => {
    const broken = `\`\`\`json\n{ this is not json\n\`\`\`\nbut here is the real one: ${answer('Cloud Run')}`;
    const outcome = parseHermesResponse(broken);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.salvaged).toBe(true);
  });

  it('reports no-json when there is nothing to parse', () => {
    const outcome = parseHermesResponse('I am just talking and never produced a block.');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('no-json');
  });

  it('reports schema-invalid when valid JSON does not match HermesResponse', () => {
    const outcome = parseHermesResponse('```json\n{"kind":"nonsense","foo":1}\n```');
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error).toBe('schema-invalid');
  });

  it('handles a discriminated union member with nested content', () => {
    const plan = JSON.stringify({
      kind: 'plan',
      summary: 'Create a VPC',
      steps: [
        { skillId: 'vpc', capability: 'networks:create', params: { name: 'core' }, rationale: 'base network' },
      ],
    });
    const outcome = parseHermesResponse(`\`\`\`json\n${plan}\n\`\`\``);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.response.kind).toBe('plan');
  });

  it('parses a diagnosis response', () => {
    const diagnosis = JSON.stringify({
      kind: 'diagnosis',
      summary: 'gcloud is not authenticated.',
      steps: [{ instruction: 'Sign in.', command: 'gcloud auth login' }],
    });
    const outcome = parseHermesResponse(`Here is the fix.\n\`\`\`json\n${diagnosis}\n\`\`\``);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.response.kind).toBe('diagnosis');
  });
});
