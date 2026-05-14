import { randomUUID } from 'node:crypto';
import {
  classifyGcloudCommand,
  enforcePolicy,
  interpolateGcloud,
  interpolateTerraform,
  type ApprovalCard,
  type ExecutionCommand,
  type ExecutionPath,
  type GuardianPolicy,
  type PlanStep,
  type ServerMessage,
  type TerraformFile,
} from '@cloud-hermes/core';
import type { SkillCatalog } from '../skills/index';
import type { WorkspaceStore } from '../workspace/index';
import { executeClassified, syncState } from '../gcp/index';
import { appendAudit } from '../audit/index';
import { resolvePlanStep } from './plan';
import { computeBlastRadius } from './blast';

/**
 * Plan execution — the three paths.
 *
 *  - commands  : interpolate each step and hand the operator copyable gcloud.
 *  - terraform : interpolate each step's Terraform template.
 *  - run       : interpolate, then re-classify the *final* argv (interpolation
 *                is never trusted), enforce the policy layer, show a
 *                blast-radius approval card, and only on approval execute
 *                through the single chokepoint — auditing at classification
 *                and at execution, then re-syncing the graph.
 */

export interface ExecutionContext {
  path: ExecutionPath;
  steps: PlanStep[];
  conversationId: string;
  workspaceId: string;
  catalog: SkillCatalog;
  store: WorkspaceStore;
  policy: GuardianPolicy;
  emit: (message: ServerMessage) => void;
  /** Requests human approval; fail-closed — anything unresolved is 'denied'. */
  requestApproval: (card: ApprovalCard) => Promise<'approved' | 'denied'>;
  signal?: AbortSignal;
}

export async function runExecution(ctx: ExecutionContext): Promise<void> {
  switch (ctx.path) {
    case 'commands':
      return runCommandsPath(ctx);
    case 'terraform':
      return runTerraformPath(ctx);
    case 'run':
      return runDirectPath(ctx);
  }
}

function runCommandsPath(ctx: ExecutionContext): void {
  const commands: ExecutionCommand[] = ctx.steps.map((step) => {
    const resolved = resolvePlanStep(step, ctx.catalog);
    if (!resolved.ok) {
      return { skillId: step.skillId, capability: step.capability, command: null, classification: 'BLOCKED', ok: false, detail: resolved.error };
    }
    const interpolated = interpolateGcloud(resolved.capability, step.params);
    if (!interpolated.ok) {
      return { skillId: step.skillId, capability: step.capability, command: null, classification: 'BLOCKED', ok: false, detail: interpolated.error };
    }
    const classified = classifyGcloudCommand(interpolated.argv, ctx.catalog.capabilityTables);
    return {
      skillId: step.skillId,
      capability: step.capability,
      command: interpolated.argv.join(' '),
      classification: classified.classification,
      ok: classified.classification !== 'BLOCKED',
      detail: classified.reason,
    };
  });
  ctx.emit({ type: 'commands', conversationId: ctx.conversationId, commands });
}

function runTerraformPath(ctx: ExecutionContext): void {
  const files: TerraformFile[] = ctx.steps.map((step, index) => {
    const resolved = resolvePlanStep(step, ctx.catalog);
    if (!resolved.ok) {
      return { name: `step-${index}.error.txt`, hcl: `# ${resolved.error}`, unresolved: [] };
    }
    const templateName = resolved.capability.terraformTemplate;
    const template = templateName !== undefined ? ctx.catalog.templates.get(templateName) : undefined;
    if (template === undefined) {
      return {
        name: `step-${index}.error.txt`,
        hcl: `# No Terraform template is available for ${step.capability}.`,
        unresolved: [],
      };
    }
    const { hcl, unresolved } = interpolateTerraform(template, step.params);
    const base = (step.params['name'] ?? `step-${index}`).replace(/[^a-z0-9-]/gi, '-');
    return { name: `${base}.tf`, hcl, unresolved };
  });
  ctx.emit({ type: 'terraform', conversationId: ctx.conversationId, files });
}

async function runDirectPath(ctx: ExecutionContext): Promise<void> {
  const graph = await ctx.store.loadGraph(ctx.workspaceId);
  const workspaceDir = ctx.store.dir(ctx.workspaceId);
  const now = (): string => new Date().toISOString();
  let executedAny = false;

  for (const step of ctx.steps) {
    const resolved = resolvePlanStep(step, ctx.catalog);
    if (!resolved.ok) {
      ctx.emit({ type: 'error', code: 'invalid-plan-step', message: resolved.error });
      continue;
    }
    const interpolated = interpolateGcloud(resolved.capability, step.params);
    if (!interpolated.ok) {
      ctx.emit({ type: 'error', code: 'invalid-params', message: interpolated.error });
      continue;
    }

    // Re-classify the final interpolated argv — interpolation is never trusted
    // to have preserved the template's safety properties.
    const classified = classifyGcloudCommand(interpolated.argv, ctx.catalog.capabilityTables);
    const classificationId = randomUUID();

    await appendAudit(workspaceDir, {
      at: now(),
      phase: 'classification',
      classificationId,
      workspaceId: ctx.workspaceId,
      argv: classified.argv,
      classification: classified.classification,
      decidedBy: classified.decidedBy,
      reason: classified.reason,
    });

    if (classified.classification === 'BLOCKED' || classified.classification === 'READ') {
      ctx.emit({
        type: 'error',
        code: 'blocked-by-guard',
        message:
          classified.classification === 'READ'
            ? 'A plan step classified as a read, not a change — nothing to run.'
            : classified.reason,
      });
      continue;
    }

    const policyVerdict = enforcePolicy(classified, ctx.policy);
    if (!policyVerdict.allowed) {
      await appendAudit(workspaceDir, {
        at: now(),
        phase: 'execution',
        classificationId,
        workspaceId: ctx.workspaceId,
        argv: classified.argv,
        classification: 'BLOCKED',
        outcome: `blocked by policy: ${policyVerdict.reason}`,
      });
      ctx.emit({ type: 'error', code: 'blocked-by-policy', message: policyVerdict.reason });
      continue;
    }

    const card: ApprovalCard = {
      approvalId: classificationId,
      argv: classified.argv,
      classification: classified.classification,
      decidedBy: classified.decidedBy,
      reason: classified.reason,
      blastRadius: computeBlastRadius(classified, graph),
      policyNotes: policyVerdict.notes,
    };

    const decision = await ctx.requestApproval(card);
    if (decision === 'denied') {
      await appendAudit(workspaceDir, {
        at: now(),
        phase: 'execution',
        classificationId,
        workspaceId: ctx.workspaceId,
        argv: classified.argv,
        classification: classified.classification,
        outcome: 'denied by operator',
      });
      ctx.emit({
        type: 'execution_result',
        conversationId: ctx.conversationId,
        approvalId: classificationId,
        ok: false,
        summary: 'Denied — not run.',
      });
      continue;
    }

    try {
      const result = await executeClassified(classified, {
        source: 'gcloud',
        commandId: classificationId,
        signal: ctx.signal,
        onTerminal: (event) =>
          ctx.emit({ type: 'terminal', classification: classified.classification, ...event }),
      });
      executedAny = true;
      await appendAudit(workspaceDir, {
        at: now(),
        phase: 'execution',
        classificationId,
        workspaceId: ctx.workspaceId,
        argv: classified.argv,
        classification: classified.classification,
        outcome: result.ok ? 'exit 0' : `exit ${result.exitCode ?? 'unknown'}: ${result.stderrTail}`,
      });
      ctx.emit({
        type: 'execution_result',
        conversationId: ctx.conversationId,
        approvalId: classificationId,
        ok: result.ok,
        summary: result.ok
          ? 'Done.'
          : `gcloud exited with code ${result.exitCode ?? 'unknown'}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await appendAudit(workspaceDir, {
        at: now(),
        phase: 'execution',
        classificationId,
        workspaceId: ctx.workspaceId,
        argv: classified.argv,
        classification: classified.classification,
        outcome: `error: ${message}`,
      });
      ctx.emit({
        type: 'execution_result',
        conversationId: ctx.conversationId,
        approvalId: classificationId,
        ok: false,
        summary: message,
      });
    }
  }

  // Re-sync after execution so the snapshot reflects reality.
  if (executedAny) {
    const workspace = await ctx.store.load(ctx.workspaceId);
    if (workspace !== null) {
      const { graph: fresh, raw } = await syncState(workspace.projectId, { signal: ctx.signal });
      await ctx.store.saveGraph(ctx.workspaceId, fresh, raw);
    }
  }
}
