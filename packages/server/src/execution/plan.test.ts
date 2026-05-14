import { describe, it, expect } from 'vitest';
import type { ParsedSkill, PlanStep, SkillManifest } from '@cloud-hermes/core';
import { resolvePlanStep } from './plan';
import type { SkillCatalog } from '../skills/index';

const vpcSkill: ParsedSkill = {
  body: 'VPC skill body',
  frontmatter: {
    id: 'vpc',
    displayName: 'VPC networks',
    description: 'Create VPC networks.',
    service: 'compute',
    dependsOn: [],
    docs: [],
    capabilities: [
      {
        resourceType: 'networks',
        verb: 'create',
        classification: 'CREATE',
        gcloudTemplate: 'gcloud compute networks create {name}',
        requiredParams: [{ name: 'name' }],
        flagDenylist: [],
      },
      {
        resourceType: 'networks',
        verb: 'describe',
        classification: 'READ',
        gcloudTemplate: 'gcloud compute networks describe {name}',
        requiredParams: [{ name: 'name' }],
        flagDenylist: [],
      },
    ],
  },
};

const catalog: SkillCatalog = {
  skills: new Map([['vpc', vpcSkill]]),
  manifest: { builtAt: '', entries: [] } as SkillManifest,
  capabilityTables: [],
  templates: new Map(),
  errors: [],
};

const step = (over: Partial<PlanStep>): PlanStep => ({
  skillId: 'vpc',
  capability: 'networks:create',
  params: { name: 'core' },
  rationale: 'because',
  ...over,
});

describe('resolvePlanStep', () => {
  it('resolves a resourceType:verb capability', () => {
    const result = resolvePlanStep(step({}), catalog);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.capability.verb).toBe('create');
  });

  it('resolves a bare verb when it is unambiguous', () => {
    const result = resolvePlanStep(step({ capability: 'create' }), catalog);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.capability.resourceType).toBe('networks');
  });

  it('rejects an unknown skill', () => {
    expect(resolvePlanStep(step({ skillId: 'nope' }), catalog).ok).toBe(false);
  });

  it('rejects a capability the skill does not declare', () => {
    expect(resolvePlanStep(step({ capability: 'networks:delete' }), catalog).ok).toBe(false);
  });
});
