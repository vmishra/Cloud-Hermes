import { describe, it, expect } from 'vitest';
import { renderEnvironmentReport, type EnvironmentReport } from './report';

const base: EnvironmentReport = {
  platform: 'linux',
  nodeVersion: 'v24.13.0',
  gcloud: {
    installed: true,
    version: 'Google Cloud SDK 500.0.0',
    account: 'me@example.com',
    adc: true,
    project: 'demo-project',
  },
  terraform: { installed: false, version: null },
  harnesses: [
    { id: 'claude', installed: true, version: '2.1.141' },
    { id: 'gemini', installed: false, version: null },
  ],
  workspace: {
    name: 'Production',
    projectId: 'demo-project',
    syncedAt: '2026-05-15T00:00:00.000Z',
    unavailableSlices: [],
  },
};

describe('renderEnvironmentReport', () => {
  it('renders the operator\'s real values so commands can be customized', () => {
    const text = renderEnvironmentReport(base);
    expect(text).toContain('platform: linux');
    expect(text).toContain('node: v24.13.0');
    expect(text).toContain('account: me@example.com');
    expect(text).toContain('configured project: demo-project');
    expect(text).toContain('terraform: not installed');
    expect(text).toContain('claude: installed (2.1.141)');
    expect(text).toContain('gemini: not installed');
    expect(text).toContain('"Production"');
  });

  it('reports a missing gcloud plainly', () => {
    const text = renderEnvironmentReport({
      ...base,
      gcloud: { installed: false, version: null, account: null, adc: false, project: null },
    });
    expect(text).toContain('gcloud: not installed');
  });

  it('notes there is no workspace yet during onboarding', () => {
    const text = renderEnvironmentReport({ ...base, workspace: null });
    expect(text).toContain('workspace: none yet');
  });

  it('surfaces unavailable sync slices — often the real cause', () => {
    const text = renderEnvironmentReport({
      ...base,
      workspace: { ...base.workspace!, unavailableSlices: ['compute-firewall-rules'] },
    });
    expect(text).toContain('unavailable slices: compute-firewall-rules');
  });
});
