/**
 * Secret redaction.
 *
 * Cloud Hermes streams every subprocess — including `gcloud auth` flows — to
 * the live terminal view, and feeds subprocess output back to the reasoning
 * harness. Either path could carry a credential. Every chunk runs through this
 * redactor first, so the terminal view cannot become an exfiltration surface
 * in a screen-share and a token cannot leak into a prompt.
 *
 * The patterns are deliberately targeted rather than broad: over-redaction
 * that mangles ordinary output trains operators to ignore the redaction.
 */

interface RedactionPattern {
  name: string;
  pattern: RegExp;
  /** Replacement text; may reference capture groups with `$1`, `$2`, ... */
  replacement: string;
}

const PATTERNS: RedactionPattern[] = [
  {
    name: 'google-oauth-token',
    pattern: /ya29\.[A-Za-z0-9._-]{12,}/g,
    replacement: '[redacted: oauth-token]',
  },
  {
    name: 'google-api-key',
    pattern: /AIza[A-Za-z0-9_-]{20,}/g,
    replacement: '[redacted: api-key]',
  },
  {
    name: 'private-key-block',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[redacted: private-key]',
  },
  {
    name: 'authorization-header',
    pattern: /(authorization\s*:\s*)(?:bearer\s+)?\S+/gi,
    replacement: '$1[redacted]',
  },
  {
    name: 'bearer-token',
    pattern: /\bBearer\s+[A-Za-z0-9._~+\/=-]{8,}/g,
    replacement: 'Bearer [redacted]',
  },
  {
    name: 'json-secret-field',
    pattern:
      /("(?:access_token|refresh_token|client_secret|private_key|id_token|api_key|client_email)"\s*:\s*")[^"]*"/gi,
    replacement: '$1[redacted]"',
  },
];

/** Redacts credential-shaped strings from text. Safe to run on any chunk; text
 *  with nothing sensitive passes through unchanged. */
export function redactSecrets(text: string): string {
  let output = text;
  for (const { pattern, replacement } of PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}
