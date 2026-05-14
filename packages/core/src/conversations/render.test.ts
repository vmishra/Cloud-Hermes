import { describe, it, expect } from 'vitest';
import { renderResponseMarkdown } from './render';

describe('renderResponseMarkdown', () => {
  it('renders an answer with its citations', () => {
    const markdown = renderResponseMarkdown({
      kind: 'answer',
      markdown: 'Cloud Run runs containers without managing servers.',
      citations: [{ label: 'service catalog', resourceId: 'svc/run' }],
    });
    expect(markdown).toContain('Cloud Run runs containers');
    expect(markdown).toContain('service catalog');
  });

  it('renders a plan with numbered steps', () => {
    const markdown = renderResponseMarkdown({
      kind: 'plan',
      summary: 'Create a VPC',
      steps: [
        { skillId: 'vpc', capability: 'networks:create', params: { name: 'core' }, rationale: 'base network' },
      ],
    });
    expect(markdown).toContain('**Plan:** Create a VPC');
    expect(markdown).toContain('1. `vpc:networks:create`');
  });

  it('renders clarifying questions as a list', () => {
    const markdown = renderResponseMarkdown({
      kind: 'clarifying_questions',
      questions: [{ id: 'q1', question: 'Which region?' }],
    });
    expect(markdown).toContain('- Which region?');
  });

  it('renders a skill request', () => {
    const markdown = renderResponseMarkdown({ kind: 'skill_request', skills: ['vpc', 'subnet'] });
    expect(markdown).toContain('vpc, subnet');
  });
});
