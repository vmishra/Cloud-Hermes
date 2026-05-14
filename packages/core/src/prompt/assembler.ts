/**
 * The prompt assembler.
 *
 * A pure function with a fixed section order: system framing, then user
 * memory, then skills, then project state, then conversation history, then the
 * current message. The order is deliberate and tested — the most stable
 * content goes first so prompt caching pays off, and a single reordering would
 * silently destroy the cache hit rate.
 */

export interface PromptSections {
  /** Static system framing — identity, response contract, rules. Always present. */
  systemFraming: string;
  /** Bounded recalled-preferences block. Context-fenced by the memory layer. */
  userMemory?: string;
  /** Loaded skill bodies, concatenated. */
  skills?: string;
  /** Compact, deterministically-serialized resource-graph summary. */
  stateSummary?: string;
  /** Prior turns of the conversation, rendered. */
  history?: string;
  /** The current user message. Always present. */
  userMessage: string;
}

/** The order sections appear in the assembled prompt — stable content first. */
export const PROMPT_SECTION_ORDER = [
  'systemFraming',
  'userMemory',
  'skills',
  'stateSummary',
  'history',
  'userMessage',
] as const satisfies readonly (keyof PromptSections)[];

const SECTION_LABELS: Record<keyof PromptSections, string> = {
  systemFraming: 'SYSTEM',
  userMemory: 'USER MEMORY',
  skills: 'SKILLS',
  stateSummary: 'PROJECT STATE',
  history: 'CONVERSATION SO FAR',
  userMessage: 'CURRENT MESSAGE',
};

const SECTION_RULE = '\n\n----------------------------------------\n\n';

function renderSection(label: string, body: string): string {
  return `# ${label}\n\n${body.trim()}`;
}

/**
 * Assembles the sections into a single prompt string. Optional sections are
 * omitted entirely when absent or blank; `systemFraming` and `userMessage` are
 * always included.
 */
export function assemblePrompt(sections: PromptSections): string {
  const parts: string[] = [];
  for (const key of PROMPT_SECTION_ORDER) {
    const value = sections[key];
    if (value === undefined || value.trim() === '') {
      if (key === 'systemFraming' || key === 'userMessage') {
        throw new Error(`assemblePrompt: required section "${key}" is missing or blank.`);
      }
      continue;
    }
    parts.push(renderSection(SECTION_LABELS[key], value));
  }
  return parts.join(SECTION_RULE);
}
