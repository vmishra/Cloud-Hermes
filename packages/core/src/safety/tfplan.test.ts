import { describe, it, expect } from 'vitest';
import { classifyTerraformPlan } from './tfplan';

const plan = (changes: { address: string; type: string; actions: string[] }[]) => ({
  resource_changes: changes.map((change) => ({
    address: change.address,
    type: change.type,
    name: change.address.split('.').at(-1),
    change: { actions: change.actions },
  })),
});

describe('classifyTerraformPlan', () => {
  it('classifies a create-only plan as CREATE', () => {
    const result = classifyTerraformPlan(
      plan([{ address: 'google_compute_network.core', type: 'google_compute_network', actions: ['create'] }]),
    );
    expect(result.classification).toBe('CREATE');
    expect(result.changes).toHaveLength(1);
  });

  it('classifies an in-place update as UPDATE', () => {
    const result = classifyTerraformPlan(
      plan([{ address: 'google_compute_firewall.allow', type: 'google_compute_firewall', actions: ['update'] }]),
    );
    expect(result.classification).toBe('UPDATE');
  });

  it('BLOCKS a plan that deletes a resource', () => {
    const result = classifyTerraformPlan(
      plan([{ address: 'google_compute_instance.vm', type: 'google_compute_instance', actions: ['delete'] }]),
    );
    expect(result.classification).toBe('BLOCKED');
    expect(result.reason).toContain('google_compute_instance.vm');
  });

  it('BLOCKS a replace — a delete-then-create disguised as an edit', () => {
    const result = classifyTerraformPlan(
      plan([
        { address: 'google_compute_subnetwork.sub', type: 'google_compute_subnetwork', actions: ['delete', 'create'] },
      ]),
    );
    expect(result.classification).toBe('BLOCKED');
  });

  it('treats a no-op plan as READ', () => {
    const result = classifyTerraformPlan(
      plan([{ address: 'google_compute_network.core', type: 'google_compute_network', actions: ['no-op'] }]),
    );
    expect(result.classification).toBe('READ');
    expect(result.changes).toHaveLength(0);
  });

  it('BLOCKS an unparseable plan — default-deny', () => {
    expect(classifyTerraformPlan('not a plan').classification).toBe('BLOCKED');
    expect(classifyTerraformPlan(null).classification).toBe('BLOCKED');
    expect(classifyTerraformPlan({ resource_changes: 'wrong' }).classification).toBe('BLOCKED');
  });

  it('BLOCKS when any one resource in a mixed plan is destroyed', () => {
    const result = classifyTerraformPlan(
      plan([
        { address: 'google_compute_network.core', type: 'google_compute_network', actions: ['create'] },
        { address: 'google_compute_instance.old', type: 'google_compute_instance', actions: ['delete'] },
      ]),
    );
    expect(result.classification).toBe('BLOCKED');
  });
});
