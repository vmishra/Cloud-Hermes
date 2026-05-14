import { describe, it, expect } from 'vitest';
import { assemblePrompt, PROMPT_SECTION_ORDER } from './assembler';

describe('assemblePrompt', () => {
  it('keeps the fixed section order, stable content first', () => {
    const prompt = assemblePrompt({
      systemFraming: 'FRAMING',
      userMemory: 'MEMORY',
      skills: 'SKILLS',
      stateSummary: 'STATE',
      history: 'HISTORY',
      userMessage: 'MESSAGE',
    });

    const positions = ['FRAMING', 'MEMORY', 'SKILLS', 'STATE', 'HISTORY', 'MESSAGE'].map((s) =>
      prompt.indexOf(s),
    );
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
    expect(positions.every((p) => p >= 0)).toBe(true);
  });

  it('omits optional sections that are absent or blank', () => {
    const prompt = assemblePrompt({
      systemFraming: 'FRAMING',
      userMemory: '   ',
      userMessage: 'MESSAGE',
    });

    expect(prompt).toContain('# SYSTEM');
    expect(prompt).toContain('# CURRENT MESSAGE');
    expect(prompt).not.toContain('# USER MEMORY');
    expect(prompt).not.toContain('# SKILLS');
    expect(prompt).not.toContain('# PROJECT STATE');
  });

  it('throws when a required section is missing or blank', () => {
    expect(() => assemblePrompt({ systemFraming: '', userMessage: 'M' })).toThrow(/systemFraming/);
    expect(() => assemblePrompt({ systemFraming: 'F', userMessage: '  ' })).toThrow(/userMessage/);
  });

  it('starts with system framing and ends with the current message', () => {
    const prompt = assemblePrompt({
      systemFraming: 'FRAMING',
      skills: 'SKILLS',
      userMessage: 'MESSAGE',
    });
    expect(prompt.startsWith('# SYSTEM')).toBe(true);
    expect(prompt.trimEnd().endsWith('MESSAGE')).toBe(true);
  });

  it('declares system framing first and the message last in the order', () => {
    expect(PROMPT_SECTION_ORDER[0]).toBe('systemFraming');
    expect(PROMPT_SECTION_ORDER.at(-1)).toBe('userMessage');
  });
});
