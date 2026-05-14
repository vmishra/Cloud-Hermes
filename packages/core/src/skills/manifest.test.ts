import { describe, it, expect } from 'vitest';
import { isManifestStale, renderManifestIndex, type SkillManifest, type FileStamp } from './manifest';

const manifest: SkillManifest = {
  builtAt: '2026-05-15T00:00:00.000Z',
  entries: [
    {
      id: 'vpc',
      displayName: 'VPC networks',
      description: 'Create VPC networks.',
      service: 'compute',
      dependsOn: [],
      path: 'services/vpc.md',
      mtimeMs: 1000,
      size: 500,
    },
  ],
};

const stamp = (over: Partial<FileStamp> = {}): FileStamp => ({
  path: 'services/vpc.md',
  mtimeMs: 1000,
  size: 500,
  ...over,
});

describe('isManifestStale', () => {
  it('is not stale when every file matches', () => {
    expect(isManifestStale(manifest, [stamp()])).toBe(false);
  });

  it('is stale when a file count differs', () => {
    expect(isManifestStale(manifest, [])).toBe(true);
    expect(isManifestStale(manifest, [stamp(), stamp({ path: 'services/subnet.md' })])).toBe(true);
  });

  it('is stale when a file mtime or size changed', () => {
    expect(isManifestStale(manifest, [stamp({ mtimeMs: 2000 })])).toBe(true);
    expect(isManifestStale(manifest, [stamp({ size: 999 })])).toBe(true);
  });

  it('is stale when a path no longer exists', () => {
    expect(isManifestStale(manifest, [stamp({ path: 'services/other.md' })])).toBe(true);
  });
});

describe('renderManifestIndex', () => {
  it('renders a compact index line per skill', () => {
    const index = renderManifestIndex(manifest);
    expect(index).toContain('vpc (compute): Create VPC networks.');
  });

  it('handles an empty catalog', () => {
    expect(renderManifestIndex({ builtAt: 'x', entries: [] })).toBe('No skills are available.');
  });
});
