import { z } from 'zod';

/**
 * Terraform plan classification.
 *
 * Terraform must be classified by its *plan*, never its source. A user can
 * "edit" HCL and have `terraform plan` produce a destroy-then-create — the
 * command is `apply`, the effect is destruction. So this walks the JSON plan
 * (`terraform show -json`) and inspects the concrete `actions` of every
 * resource change. Any `delete` — including the `delete` half of a replace —
 * is BLOCKED. A plan that cannot be parsed is BLOCKED too: default-deny.
 */

const ResourceChangeSchema = z.object({
  address: z.string().optional(),
  type: z.string().optional(),
  name: z.string().optional(),
  change: z
    .object({
      actions: z.array(z.string()).default([]),
    })
    .optional(),
});

const PlanSchema = z.object({
  resource_changes: z.array(ResourceChangeSchema).optional(),
});

export interface TerraformChange {
  address: string;
  type: string;
  /** The concrete plan actions, e.g. `["create"]`, `["update"]`, `["delete","create"]`. */
  actions: string[];
}

export interface TerraformPlanClassification {
  classification: 'READ' | 'CREATE' | 'UPDATE' | 'BLOCKED';
  /** Every non-trivial change in the plan — the basis for the blast-radius view. */
  changes: TerraformChange[];
  reason: string;
}

const TRIVIAL_ACTIONS = new Set(['no-op', 'read']);

export function classifyTerraformPlan(planJson: unknown): TerraformPlanClassification {
  const parsed = PlanSchema.safeParse(planJson);
  if (!parsed.success) {
    return {
      classification: 'BLOCKED',
      changes: [],
      reason: 'The Terraform plan could not be parsed, so it cannot be verified as safe.',
    };
  }

  const changes: TerraformChange[] = [];
  for (const change of parsed.data.resource_changes ?? []) {
    const actions = change.change?.actions ?? [];
    if (actions.every((action) => TRIVIAL_ACTIONS.has(action))) continue;
    changes.push({
      address: change.address ?? change.name ?? '(unknown)',
      type: change.type ?? '(unknown)',
      actions,
    });
  }

  const destructive = changes.filter((change) => change.actions.includes('delete'));
  if (destructive.length > 0) {
    const addresses = destructive.map((change) => change.address).join(', ');
    return {
      classification: 'BLOCKED',
      changes,
      reason: `The plan would destroy or replace: ${addresses}. Cloud Hermes does not run destructive plans.`,
    };
  }

  if (changes.length === 0) {
    return { classification: 'READ', changes, reason: 'The plan makes no changes.' };
  }

  const hasUpdate = changes.some((change) => change.actions.includes('update'));
  if (hasUpdate) {
    return {
      classification: 'UPDATE',
      changes,
      reason: `The plan updates ${changes.length} resource(s) in place.`,
    };
  }

  return {
    classification: 'CREATE',
    changes,
    reason: `The plan creates ${changes.length} new resource(s).`,
  };
}
