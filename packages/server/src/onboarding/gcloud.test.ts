import { describe, it, expect } from 'vitest';
import { parseAuthList, parseProjectList, isValidProjectId } from './gcloud';

describe('parseAuthList', () => {
  it('returns the active account', () => {
    const account = parseAuthList([
      { account: 'old@example.com', status: '' },
      { account: 'me@example.com', status: 'ACTIVE' },
    ]);
    expect(account).toBe('me@example.com');
  });

  it('returns null when nothing is active or the shape is wrong', () => {
    expect(parseAuthList([{ account: 'x@example.com', status: '' }])).toBeNull();
    expect(parseAuthList([])).toBeNull();
    expect(parseAuthList('not an array')).toBeNull();
  });
});

describe('parseProjectList', () => {
  it('extracts projects and falls back to the id for a missing name', () => {
    expect(
      parseProjectList([
        { projectId: 'alpha', name: 'Project Alpha' },
        { projectId: 'bravo' },
      ]),
    ).toEqual([
      { projectId: 'alpha', name: 'Project Alpha' },
      { projectId: 'bravo', name: 'bravo' },
    ]);
  });

  it('ignores malformed entries', () => {
    expect(parseProjectList([{ name: 'no id' }, 'garbage', { projectId: 5 }])).toEqual([]);
    expect(parseProjectList(null)).toEqual([]);
  });
});

describe('isValidProjectId', () => {
  it('accepts well-formed project ids', () => {
    expect(isValidProjectId('my-project-123')).toBe(true);
    expect(isValidProjectId('abcdef')).toBe(true);
  });

  it('rejects malformed project ids', () => {
    expect(isValidProjectId('Has-Caps')).toBe(false);
    expect(isValidProjectId('short')).toBe(false);
    expect(isValidProjectId('-leading')).toBe(false);
    expect(isValidProjectId('trailing-')).toBe(false);
    expect(isValidProjectId('has space')).toBe(false);
    expect(isValidProjectId('with;metachar')).toBe(false);
  });
});
