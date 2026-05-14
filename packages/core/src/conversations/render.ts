import type { HermesResponse } from '../schemas/hermes';

/**
 * Renders a HermesResponse to markdown for the persisted conversation
 * transcript. Conversations are markdown files — the source of truth — so this
 * is what gets written to disk, and what a reloaded conversation shows.
 */
export function renderResponseMarkdown(response: HermesResponse): string {
  switch (response.kind) {
    case 'answer': {
      const citations =
        response.citations.length > 0
          ? `\n\n_Cited:_ ${response.citations
              .map((citation) =>
                [citation.label, citation.resourceId, citation.field].filter(Boolean).join(' · '),
              )
              .join('; ')}`
          : '';
      return `${response.markdown}${citations}`;
    }
    case 'clarifying_questions':
      return [
        'A few questions before continuing:',
        '',
        ...response.questions.map((question) => `- ${question.question}`),
      ].join('\n');
    case 'plan':
      return [
        `**Plan:** ${response.summary}`,
        '',
        ...response.steps.map(
          (step, index) =>
            `${index + 1}. \`${step.skillId}:${step.capability}\` — ${step.rationale}`,
        ),
      ].join('\n');
    case 'skill_request':
      return `_Loading skills: ${response.skills.join(', ')}_`;
    case 'diagnosis':
      return [
        `**Diagnosis:** ${response.summary}`,
        ...(response.rootCause !== undefined ? ['', `Root cause: ${response.rootCause}`] : []),
        '',
        ...response.steps.flatMap((step, index) => {
          const lines = [`${index + 1}. ${step.instruction}`];
          if (step.command !== undefined) lines.push('', `   \`${step.command}\``);
          if (step.verify !== undefined) lines.push(`   _Verify:_ ${step.verify}`);
          return lines;
        }),
      ].join('\n');
  }
}
