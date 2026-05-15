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

  it('renders a diagnosis with its steps and commands', () => {
    const markdown = renderResponseMarkdown({
      kind: 'diagnosis',
      summary: 'gcloud is not installed.',
      rootCause: 'the SDK is missing from this machine',
      steps: [
        {
          instruction: 'Install the Google Cloud SDK.',
          command: 'curl https://sdk.cloud.google.com | bash',
          verify: 'gcloud --version prints a version',
        },
      ],
    });
    expect(markdown).toContain('**Diagnosis:** gcloud is not installed.');
    expect(markdown).toContain('Root cause: the SDK is missing from this machine');
    expect(markdown).toContain('1. Install the Google Cloud SDK.');
    expect(markdown).toContain('curl https://sdk.cloud.google.com | bash');
    expect(markdown).toContain('_Verify:_ gcloud --version prints a version');
  });
});
