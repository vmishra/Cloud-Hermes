/**
 * Types for the safety guard.
 *
 * The guard classifies every proposed mutation into one of four buckets.
 * Anything not positively classified as safe is BLOCKED — default-deny.
 */

export type Classification = 'READ' | 'CREATE' | 'UPDATE' | 'BLOCKED';

/** The pipeline gate that produced a verdict — recorded in the audit log so
 *  every "why was this blocked?" has a precise answer. */
export type ClassifierGate =
  | 'shell-metacharacters'
  | 'not-gcloud'
  | 'hardline-floor'
  | 'undeclared-capability'
  | 'flag-denylist'
  | 'capability-table';

/** A gcloud command tokenized into its meaningful parts. */
export interface GcloudCommand {
  /** The release track. */
  track: 'ga' | 'alpha' | 'beta';
  /** The service group, e.g. `compute`. */
  service: string;
  /** The resource type — nested group names, space-joined, e.g. `networks subnets`. */
  resourceType: string;
  /** The command verb, e.g. `create`, `list`, `describe`. */
  verb: string;
  /** Positional arguments after the verb (resource names, etc.). */
  positionals: string[];
  /** Parsed flags. */
  flags: GcloudFlag[];
}

export interface GcloudFlag {
  /** The flag name including leading dashes, e.g. `--network`. */
  name: string;
  /** The value, when the flag is `--name=value` or `--name value`. */
  value?: string;
}

/**
 * One allowed capability, declared in a skill's frontmatter. The capability
 * table is the single source consulted by both the prompt assembler (for
 * guidance) and the safety guard (for the allowlist) — there is no second copy.
 */
export interface Capability {
  /** The service group, e.g. `compute`. */
  service: string;
  /** The resource type — nested group names, space-joined, e.g. `networks subnets`. */
  resourceType: string;
  /** The command verb, e.g. `create`. */
  verb: string;
  /** How a command matching this capability is classified. Never BLOCKED — a
   *  capability is by definition an allowed operation. */
  classification: 'READ' | 'CREATE' | 'UPDATE';
  /** Flag-name prefixes denied for this capability, e.g. `--clear-`, `--no-`,
   *  `--remove-`. Matched against flag-token prefixes, never substrings. */
  flagDenylist?: string[];
}

/** A skill's capability table — the allowlist contribution for its service. */
export interface CapabilityTable {
  skillId: string;
  capabilities: Capability[];
}

/**
 * The single verdict object. The verb table, flag denylist, policy layer, and
 * (for Terraform) the plan parser all fold into one of these — the approval
 * card binds to it, and the audit log records it.
 */
export interface ClassifiedCommand {
  /** The exact argv that was classified — and, if approved, what is executed. */
  argv: string[];
  classification: Classification;
  /** Which gate produced the verdict. */
  decidedBy: ClassifierGate;
  /** Human-readable explanation — always set; required reading when BLOCKED. */
  reason: string;
  /** The parsed command, when tokenization got far enough to produce it. */
  command?: GcloudCommand;
}
