import { z } from 'zod';
import type { ClassifiedCommand, GcloudCommand } from '../safety/types';
import { cidrContains } from './cidr';

/**
 * The Guardian policy layer.
 *
 * A per-workspace `policy.json` that narrows what is permitted *within* the
 * already-safe set the guard allows. The guard is the floor — destructive
 * operations are structurally unreachable regardless of policy — and the policy
 * only constrains further: which regions, zones, services, machine types, and
 * CIDR ranges an operator allows. Policy can never loosen a guard verdict.
 */

export const ApprovalMode = z.enum(['always-confirm', 'auto-run-creates']);

export const GuardianPolicy = z.object({
  /** Allowed regions; empty means any region is permitted. */
  allowedRegions: z.array(z.string()).default([]),
  /** Allowed zones; empty means any zone is permitted. */
  allowedZones: z.array(z.string()).default([]),
  /** Allowed gcloud services; empty means any guard-permitted service is fine. */
  allowedServices: z.array(z.string()).default([]),
  /** Allowed machine types; empty means any is permitted. */
  allowedMachineTypes: z.array(z.string()).default([]),
  /** CIDR ranges a created or updated subnet range must fall within; empty
   *  means any range is permitted. */
  allowedCidrs: z.array(z.string()).default([]),
  /** `always-confirm` (default) requires explicit confirmation for every
   *  mutation; `auto-run-creates` opts low-risk pure creates out of it. */
  approvalMode: ApprovalMode.default('always-confirm'),
});

export type ApprovalMode = z.infer<typeof ApprovalMode>;
export type GuardianPolicy = z.infer<typeof GuardianPolicy>;

/** The default policy: nothing constrained, every mutation confirmed. */
export const DEFAULT_POLICY: GuardianPolicy = GuardianPolicy.parse({});

export type PolicyVerdict =
  | { allowed: true; approvalMode: ApprovalMode; notes: string[] }
  | { allowed: false; reason: string };

const canonical = (value: string): string => value.trim().toLowerCase();

function flagValue(command: GcloudCommand | undefined, name: string): string | undefined {
  return command?.flags.find((flag) => flag.name === name)?.value;
}

/**
 * Narrows a guard verdict by the workspace policy. A command the guard already
 * BLOCKED stays blocked; this only ever rejects further, never permits more.
 */
export function enforcePolicy(
  classified: ClassifiedCommand,
  policy: GuardianPolicy,
): PolicyVerdict {
  if (classified.classification === 'BLOCKED') {
    return { allowed: false, reason: classified.reason };
  }

  const command = classified.command;

  if (policy.allowedServices.length > 0 && command) {
    const allowed = policy.allowedServices.map(canonical);
    if (!allowed.includes(canonical(command.service))) {
      return { allowed: false, reason: `Policy does not permit the "${command.service}" service.` };
    }
  }

  const region = flagValue(command, '--region');
  if (region !== undefined && policy.allowedRegions.length > 0) {
    if (!policy.allowedRegions.map(canonical).includes(canonical(region))) {
      return { allowed: false, reason: `Policy does not permit the region "${region}".` };
    }
  }

  const zone = flagValue(command, '--zone');
  if (zone !== undefined && policy.allowedZones.length > 0) {
    if (!policy.allowedZones.map(canonical).includes(canonical(zone))) {
      return { allowed: false, reason: `Policy does not permit the zone "${zone}".` };
    }
  }

  const machineType = flagValue(command, '--machine-type');
  if (machineType !== undefined && policy.allowedMachineTypes.length > 0) {
    if (!policy.allowedMachineTypes.map(canonical).includes(canonical(machineType))) {
      return {
        allowed: false,
        reason: `Policy does not permit the machine type "${machineType}".`,
      };
    }
  }

  const range = flagValue(command, '--range');
  if (range !== undefined && policy.allowedCidrs.length > 0) {
    const withinAllowed = policy.allowedCidrs.some((allowed) => cidrContains(allowed, range));
    if (!withinAllowed) {
      return {
        allowed: false,
        reason: `Policy does not permit the range "${range}" — it falls outside every allowed CIDR.`,
      };
    }
  }

  return { allowed: true, approvalMode: policy.approvalMode, notes: [] };
}
