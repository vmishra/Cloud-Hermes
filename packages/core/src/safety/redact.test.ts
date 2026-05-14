import { describe, it, expect } from 'vitest';
import { redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('redacts a Google OAuth access token', () => {
    const input = 'token: ya29.a0AfH6SMBexampleAccessTokenValue123456';
    const output = redactSecrets(input);
    expect(output).not.toContain('ya29.a0AfH6');
    expect(output).toContain('[redacted: oauth-token]');
  });

  it('redacts a Google API key', () => {
    const input = 'key=AIzaSyDexampleApiKeyValue1234567890abcd';
    expect(redactSecrets(input)).not.toContain('AIzaSyD');
  });

  it('redacts a private key block', () => {
    const input = [
      'before',
      '-----BEGIN PRIVATE KEY-----',
      'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCexamplekeymaterial',
      '-----END PRIVATE KEY-----',
      'after',
    ].join('\n');
    const output = redactSecrets(input);
    expect(output).toContain('before');
    expect(output).toContain('after');
    expect(output).toContain('[redacted: private-key]');
    expect(output).not.toContain('examplekeymaterial');
  });

  it('redacts an Authorization bearer header', () => {
    const input = 'Authorization: Bearer abc123.def456.ghi789tokenvalue';
    const output = redactSecrets(input);
    expect(output).not.toContain('abc123.def456');
    expect(output.toLowerCase()).toContain('authorization');
  });

  it('redacts JSON credential fields but keeps the surrounding shape', () => {
    const input = '{"access_token":"secretvalue123","expires_in":3599}';
    const output = redactSecrets(input);
    expect(output).not.toContain('secretvalue123');
    expect(output).toContain('"access_token":"[redacted]"');
    expect(output).toContain('"expires_in":3599');
  });

  it('redacts a refresh_token field', () => {
    const input = '{"refresh_token": "1//abcDEFrefreshtokenvalue"}';
    expect(redactSecrets(input)).not.toContain('refreshtokenvalue');
  });

  it('leaves ordinary command output untouched', () => {
    const input = 'Created [https://www.googleapis.com/compute/v1/projects/demo/global/networks/core].';
    expect(redactSecrets(input)).toBe(input);
  });
});
