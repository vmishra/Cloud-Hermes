import { describe, it, expect } from 'vitest';
import { parseSkillFile, toCapabilityTable } from './parse';

const validSkill = `---
id: vpc
displayName: VPC networks
description: Create and inspect VPC networks.
service: compute
dependsOn: []
docs:
  - https://cloud.google.com/vpc/docs
capabilities:
  - resourceType: networks
    verb: create
    classification: CREATE
    gcloudTemplate: "gcloud compute networks create {name} --subnet-mode={subnetMode}"
    requiredParams:
      - name: name
        pattern: "^[a-z-]+$"
  - resourceType: networks
    verb: describe
    classification: READ
    gcloudTemplate: "gcloud compute networks describe {name}"
---
# VPC networks

The body fed to the reasoning CLI.`;

describe('parseSkillFile', () => {
  it('parses a valid skill into frontmatter and body', () => {
    const result = parseSkillFile(validSkill);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.skill.frontmatter.id).toBe('vpc');
      expect(result.skill.frontmatter.capabilities).toHaveLength(2);
      expect(result.skill.body).toBe('# VPC networks\n\nThe body fed to the reasoning CLI.');
    }
  });

  it('rejects a file with no frontmatter', () => {
    const result = parseSkillFile('# Just a markdown file');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/frontmatter/);
  });

  it('rejects frontmatter that fails the schema — fail closed', () => {
    const broken = `---
id: vpc
displayName: VPC
description: missing the service field and capabilities
---
body`;
    const result = parseSkillFile(broken);
    expect(result.ok).toBe(false);
  });

  it('rejects a capability with an unknown classification', () => {
    const broken = validSkill.replace('classification: CREATE', 'classification: DESTROY');
    const result = parseSkillFile(broken);
    expect(result.ok).toBe(false);
  });
});

describe('toCapabilityTable', () => {
  it('derives the safety guard capability table from frontmatter', () => {
    const result = parseSkillFile(validSkill);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const table = toCapabilityTable(result.skill.frontmatter);
    expect(table.skillId).toBe('vpc');
    expect(table.capabilities).toEqual([
      { service: 'compute', resourceType: 'networks', verb: 'create', classification: 'CREATE', flagDenylist: [] },
      { service: 'compute', resourceType: 'networks', verb: 'describe', classification: 'READ', flagDenylist: [] },
    ]);
  });
});
