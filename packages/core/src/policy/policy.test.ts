import { describe, it, expect } from 'vitest';
import { classifyGcloudCommand } from '../safety/classifier';
import type { CapabilityTable } from '../safety/types';
import { enforcePolicy, GuardianPolicy, DEFAULT_POLICY } from './policy';

const tables: CapabilityTable[] = [
  {
    skillId: 'compute',
    capabilities: [
      { service: 'compute', resourceType: 'instances', verb: 'create', classification: 'CREATE' },
      { service: 'compute', resourceType: 'networks subnets', verb: 'create', classification: 'CREATE' },
    ],
  },
];

const classify = (argv: string[]) => classifyGcloudCommand(argv, tables);

describe('enforcePolicy', () => {
  it('allows anything under the default policy', () => {
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'instances', 'create', 'vm', '--zone=us-central1-a']),
      DEFAULT_POLICY,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('passes the approval mode through to the verdict', () => {
    const policy = GuardianPolicy.parse({ approvalMode: 'auto-run-creates' });
    const verdict = enforcePolicy(classify(['gcloud', 'compute', 'instances', 'create', 'vm']), policy);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.approvalMode).toBe('auto-run-creates');
  });

  it('blocks a region outside the allowlist', () => {
    const policy = GuardianPolicy.parse({ allowedRegions: ['europe-west1'] });
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'networks', 'subnets', 'create', 'sub', '--region=us-central1']),
      policy,
    );
    expect(verdict.allowed).toBe(false);
  });

  it('allows a region inside the allowlist, canonicalizing case', () => {
    const policy = GuardianPolicy.parse({ allowedRegions: ['europe-west1'] });
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'networks', 'subnets', 'create', 'sub', '--region=Europe-West1']),
      policy,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('blocks a service outside the allowlist', () => {
    const policy = GuardianPolicy.parse({ allowedServices: ['storage'] });
    const verdict = enforcePolicy(classify(['gcloud', 'compute', 'instances', 'create', 'vm']), policy);
    expect(verdict.allowed).toBe(false);
  });

  it('blocks a machine type outside the allowlist', () => {
    const policy = GuardianPolicy.parse({ allowedMachineTypes: ['e2-micro', 'e2-small'] });
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'instances', 'create', 'vm', '--machine-type=n2-standard-8']),
      policy,
    );
    expect(verdict.allowed).toBe(false);
  });

  it('blocks a subnet range outside the allowed CIDRs', () => {
    const policy = GuardianPolicy.parse({ allowedCidrs: ['10.0.0.0/8'] });
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'networks', 'subnets', 'create', 'sub', '--range=192.168.1.0/24']),
      policy,
    );
    expect(verdict.allowed).toBe(false);
  });

  it('allows a subnet range inside the allowed CIDRs', () => {
    const policy = GuardianPolicy.parse({ allowedCidrs: ['10.0.0.0/8'] });
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'networks', 'subnets', 'create', 'sub', '--range=10.1.2.0/24']),
      policy,
    );
    expect(verdict.allowed).toBe(true);
  });

  it('keeps a guard-BLOCKED command blocked regardless of policy', () => {
    const verdict = enforcePolicy(
      classify(['gcloud', 'compute', 'instances', 'delete', 'vm']),
      DEFAULT_POLICY,
    );
    expect(verdict.allowed).toBe(false);
  });
});
