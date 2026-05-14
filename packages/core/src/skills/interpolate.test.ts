import { describe, it, expect } from 'vitest';
import type { SkillCapability } from './schema';
import { validateParams, interpolateGcloud, interpolateTerraform } from './interpolate';

const createNetwork: SkillCapability = {
  resourceType: 'networks',
  verb: 'create',
  classification: 'CREATE',
  gcloudTemplate: 'gcloud compute networks create {name} --subnet-mode={subnetMode}',
  requiredParams: [
    { name: 'name', pattern: '^[a-z][-a-z0-9]*$' },
    { name: 'subnetMode', oneOf: ['custom', 'auto'] },
  ],
  flagDenylist: [],
};

describe('validateParams', () => {
  it('accepts params that satisfy every constraint', () => {
    expect(validateParams(createNetwork, { name: 'core', subnetMode: 'custom' }).ok).toBe(true);
  });

  it('rejects a missing required param', () => {
    expect(validateParams(createNetwork, { name: 'core' }).ok).toBe(false);
  });

  it('rejects a param that fails its pattern', () => {
    expect(validateParams(createNetwork, { name: 'Bad Name', subnetMode: 'custom' }).ok).toBe(false);
  });

  it('rejects a param outside its oneOf set', () => {
    expect(validateParams(createNetwork, { name: 'core', subnetMode: 'sometimes' }).ok).toBe(false);
  });
});

describe('interpolateGcloud', () => {
  it('interpolates a valid command into an argv array', () => {
    const result = interpolateGcloud(createNetwork, { name: 'core', subnetMode: 'custom' });
    expect(result).toEqual({
      ok: true,
      argv: ['gcloud', 'compute', 'networks', 'create', 'core', '--subnet-mode=custom'],
    });
  });

  it('keeps a value with a comma inside a single argv token', () => {
    const capability: SkillCapability = {
      resourceType: 'firewall-rules',
      verb: 'create',
      classification: 'CREATE',
      gcloudTemplate: 'gcloud compute firewall-rules create {name} --source-ranges={ranges}',
      requiredParams: [
        { name: 'name', pattern: '^[a-z-]+$' },
        { name: 'ranges', pattern: '^[0-9.,/]+$' },
      ],
      flagDenylist: [],
    };
    const result = interpolateGcloud(capability, { name: 'allow', ranges: '10.0.0.0/8,192.168.0.0/16' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.argv.at(-1)).toBe('--source-ranges=10.0.0.0/8,192.168.0.0/16');
      expect(result.argv).toHaveLength(6);
    }
  });

  it('fails when a param is invalid — no command is produced', () => {
    const result = interpolateGcloud(createNetwork, { name: 'core', subnetMode: 'nope' });
    expect(result.ok).toBe(false);
  });
});

describe('interpolateTerraform', () => {
  it('fills known slots and reports unresolved ones', () => {
    const template = 'resource "google_compute_network" "{name}" {\n  region = "{region}"\n}';
    const result = interpolateTerraform(template, { name: 'core' });
    expect(result.hcl).toContain('"core"');
    expect(result.hcl).toContain('{region}');
    expect(result.unresolved).toEqual(['region']);
  });

  it('resolves every slot when all params are provided', () => {
    const result = interpolateTerraform('name = "{name}"', { name: 'core' });
    expect(result.hcl).toBe('name = "core"');
    expect(result.unresolved).toEqual([]);
  });
});
