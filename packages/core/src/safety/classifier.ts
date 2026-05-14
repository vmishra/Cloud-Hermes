import { normalizeArgv } from './normalize';
import { isHardlineVerb } from './hardline';
import type {
  Capability,
  CapabilityTable,
  ClassifiedCommand,
  ClassifierGate,
  GcloudCommand,
  GcloudFlag,
} from './types';

/**
 * The safety classifier.
 *
 * An ordered pipeline of gates. Each gate can only reject or pass to the next
 * — never upgrade a verdict. The command is taken as an argv array, never a
 * string, so there is no shell grammar to parse and nothing to inject into.
 *
 *   1. shell metacharacters   — reject tokens carrying shell syntax
 *   2. HARDLINE floor         — destructive verbs, BLOCKED unconditionally
 *   3. tokenize structure     — split into track / command path / flags
 *   4. capability-table lookup — undeclared command, BLOCKED (default-deny)
 *   5. flag denylist          — denied flag prefixes for that capability
 *   6. classify               — the capability's declared classification
 */

/**
 * Characters that must never appear in a command token. We spawn argv-only
 * with no shell, so these are already inert — but rejecting them outright is
 * cheap defense in depth, and any control character (code < 0x20, which
 * includes newline and carriage return) is rejected too.
 */
const FORBIDDEN_METACHARACTERS = new Set<string>([
  ';',
  '&',
  '|',
  '`',
  '<',
  '>',
  '$',
  '(',
  ')',
]);

const TRACKS = new Set<string>(['alpha', 'beta']);

function hasShellMetacharacters(token: string): boolean {
  for (let i = 0; i < token.length; i += 1) {
    if (token.charCodeAt(i) < 0x20) return true;
    if (FORBIDDEN_METACHARACTERS.has(token[i]!)) return true;
  }
  return false;
}

function isFlag(token: string): boolean {
  return token.startsWith('-');
}

/** Parses `--name=value` and `--name` into a flag. The classifier only needs
 *  flag *names* for the denylist, so a value in a following token is ignored. */
function parseFlag(token: string): GcloudFlag {
  const equals = token.indexOf('=');
  if (equals === -1) return { name: token };
  return { name: token.slice(0, equals), value: token.slice(equals + 1) };
}

/** The [service, ...resourceTypeParts, verb] path a command must match. */
function capabilityPath(capability: Capability): string[] {
  return [capability.service, ...capability.resourceType.split(' ').filter(Boolean), capability.verb];
}

function block(
  argv: string[],
  decidedBy: ClassifierGate,
  reason: string,
  command?: GcloudCommand,
): ClassifiedCommand {
  return { argv, classification: 'BLOCKED', decidedBy, reason, command };
}

export function classifyGcloudCommand(
  rawArgv: readonly string[],
  tables: readonly CapabilityTable[],
): ClassifiedCommand {
  const argv = normalizeArgv(rawArgv);

  // Gate 1 — shell metacharacters.
  const offending = argv.find(hasShellMetacharacters);
  if (offending !== undefined) {
    return block(
      argv,
      'shell-metacharacters',
      `A command token contained shell metacharacters: ${JSON.stringify(offending)}.`,
    );
  }

  if (argv[0] !== 'gcloud') {
    return block(
      argv,
      'not-gcloud',
      'Only gcloud commands are classified, and the first token was not "gcloud".',
    );
  }

  // Gate 2 — the HARDLINE floor. Every non-flag token is scanned; a destructive
  // verb anywhere is BLOCKED, before any capability table can permit it.
  for (const token of argv.slice(1)) {
    if (!isFlag(token) && isHardlineVerb(token)) {
      return block(
        argv,
        'hardline-floor',
        `"${token}" is a destructive operation. Cloud Hermes does not support it, and no skill or policy can permit it.`,
      );
    }
  }

  // Gate 3 — tokenize structure: optional track, then the leading run of
  // non-flag tokens (command path + positionals), then flags.
  let cursor = 1;
  let track: GcloudCommand['track'] = 'ga';
  const maybeTrack = argv[cursor];
  if (maybeTrack !== undefined && TRACKS.has(maybeTrack)) {
    track = maybeTrack as 'alpha' | 'beta';
    cursor += 1;
  }

  const head: string[] = [];
  let index = cursor;
  for (; index < argv.length; index += 1) {
    if (isFlag(argv[index]!)) break;
    head.push(argv[index]!);
  }
  const flags = argv.slice(index).filter(isFlag).map(parseFlag);

  // Gate 4 — capability-table lookup. The longest capability path that is a
  // prefix of the head wins; no match means the command is undeclared.
  let match: { capability: Capability; path: string[]; skillId: string } | null = null;
  for (const table of tables) {
    for (const capability of table.capabilities) {
      const path = capabilityPath(capability);
      if (path.length > head.length) continue;
      if (!path.every((segment, idx) => segment === head[idx])) continue;
      if (match === null || path.length > match.path.length) {
        match = { capability, path, skillId: table.skillId };
      }
    }
  }

  if (match === null) {
    return block(
      argv,
      'undeclared-capability',
      'No skill declares this command. A command runs only when a capability table positively permits it.',
    );
  }

  const command: GcloudCommand = {
    track,
    service: match.capability.service,
    resourceType: match.capability.resourceType,
    verb: match.capability.verb,
    positionals: head.slice(match.path.length),
    flags,
  };

  // Gate 5 — per-capability flag denylist, matched against flag-name prefixes.
  const denylist = match.capability.flagDenylist ?? [];
  const deniedFlag = flags.find((flag) => denylist.some((prefix) => flag.name.startsWith(prefix)));
  if (deniedFlag) {
    return block(
      argv,
      'flag-denylist',
      `The flag "${deniedFlag.name}" is not permitted for this operation.`,
      command,
    );
  }

  // Gate 6 — classify with the capability's declared classification.
  return {
    argv,
    classification: match.capability.classification,
    decidedBy: 'capability-table',
    reason: `Permitted by skill "${match.skillId}".`,
    command,
  };
}
