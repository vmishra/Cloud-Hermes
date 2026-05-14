import { describe, it, expect } from 'vitest';
import { classifyGcloudCommand } from './classifier';
import type { CapabilityTable } from './types';

const tables: CapabilityTable[] = [
  {
    skillId: 'vpc',
    capabilities: [
      { service: 'compute', resourceType: 'networks', verb: 'create', classification: 'CREATE' },
      { service: 'compute', resourceType: 'networks', verb: 'list', classification: 'READ' },
      {
        service: 'compute',
        resourceType: 'networks',
        verb: 'update',
        classification: 'UPDATE',
        flagDenylist: ['--clear-', '--remove-'],
      },
      {
        service: 'compute',
        resourceType: 'networks subnets',
        verb: 'create',
        classification: 'CREATE',
      },
    ],
  },
];

const fullwidth = (ascii: string): string =>
  [...ascii].map((ch) => String.fromCodePoint(ch.charCodeAt(0) - 0x20 + 0xff00)).join('');

describe('classifyGcloudCommand — allowing declared commands', () => {
  it('classifies a declared create command as CREATE', () => {
    const result = classifyGcloudCommand(['gcloud', 'compute', 'networks', 'create', 'core'], tables);
    expect(result.classification).toBe('CREATE');
    expect(result.decidedBy).toBe('capability-table');
    expect(result.command?.positionals).toEqual(['core']);
  });

  it('classifies a declared list command as READ', () => {
    const result = classifyGcloudCommand(['gcloud', 'compute', 'networks', 'list'], tables);
    expect(result.classification).toBe('READ');
  });

  it('parses the beta track', () => {
    const result = classifyGcloudCommand(['gcloud', 'beta', 'compute', 'networks', 'create', 'core'], tables);
    expect(result.classification).toBe('CREATE');
    expect(result.command?.track).toBe('beta');
  });

  it('matches the longest capability path for nested resource types', () => {
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', 'subnets', 'create', 'sub-a'],
      tables,
    );
    expect(result.classification).toBe('CREATE');
    expect(result.command?.resourceType).toBe('networks subnets');
    expect(result.command?.positionals).toEqual(['sub-a']);
  });
});

describe('classifyGcloudCommand — the HARDLINE floor', () => {
  it('blocks a destructive verb', () => {
    const result = classifyGcloudCommand(['gcloud', 'compute', 'networks', 'delete', 'core'], tables);
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('hardline-floor');
  });

  it('blocks a destructive verb even when a capability table tries to permit it', () => {
    const evilTables: CapabilityTable[] = [
      {
        skillId: 'evil',
        capabilities: [
          { service: 'compute', resourceType: 'networks', verb: 'delete', classification: 'UPDATE' },
        ],
      },
    ];
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', 'delete', 'core'],
      evilTables,
    );
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('hardline-floor');
  });

  it('blocks destructive verb prefixes', () => {
    for (const verb of ['remove-iam-policy-binding', 'abandon-instances', 'detach-disk']) {
      const result = classifyGcloudCommand(['gcloud', 'compute', 'instances', verb, 'vm'], tables);
      expect(result.classification).toBe('BLOCKED');
      expect(result.decidedBy).toBe('hardline-floor');
    }
  });

  it('blocks a destructive verb obfuscated with fullwidth characters', () => {
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', fullwidth('delete'), 'core'],
      tables,
    );
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('hardline-floor');
  });

  it('blocks a destructive verb obfuscated with a zero-width character', () => {
    const sneaky = `de${String.fromCodePoint(0x200b)}lete`;
    const result = classifyGcloudCommand(['gcloud', 'compute', 'networks', sneaky, 'core'], tables);
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('hardline-floor');
  });
});

describe('classifyGcloudCommand — default-deny and structural rejection', () => {
  it('blocks an undeclared command', () => {
    const result = classifyGcloudCommand(['gcloud', 'compute', 'instances', 'create', 'vm'], tables);
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('undeclared-capability');
  });

  it('blocks tokens carrying shell metacharacters', () => {
    for (const token of ['core;rm', 'core|cat', '$(whoami)', 'a&b']) {
      const result = classifyGcloudCommand(['gcloud', 'compute', 'networks', 'create', token], tables);
      expect(result.classification).toBe('BLOCKED');
      expect(result.decidedBy).toBe('shell-metacharacters');
    }
  });

  it('blocks a non-gcloud invocation', () => {
    const result = classifyGcloudCommand(['rm', '-rf', '/'], tables);
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('not-gcloud');
  });

  it('blocks an empty argv', () => {
    expect(classifyGcloudCommand([], tables).classification).toBe('BLOCKED');
  });
});

describe('classifyGcloudCommand — the flag denylist', () => {
  it('blocks a denied flag prefix', () => {
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', 'update', 'core', '--clear-labels'],
      tables,
    );
    expect(result.classification).toBe('BLOCKED');
    expect(result.decidedBy).toBe('flag-denylist');
  });

  it('allows the same command without the denied flag', () => {
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', 'update', 'core', '--description=primary'],
      tables,
    );
    expect(result.classification).toBe('UPDATE');
  });

  it('matches the denylist by prefix, not substring', () => {
    // The denylist entry is "--clear-"; a flag merely containing "clear" is fine.
    const result = classifyGcloudCommand(
      ['gcloud', 'compute', 'networks', 'update', 'core', '--description=clears-nothing'],
      tables,
    );
    expect(result.classification).toBe('UPDATE');
  });
});
