/**
 * Minimal IPv4 CIDR arithmetic.
 *
 * Used by the policy layer to check that a proposed subnet range falls within
 * an allowed range. Values are canonicalized to a normalized form before any
 * comparison, so `10.0.0.0/8 ` and `10.000.000.000/8` cannot dodge a check.
 */

export interface ParsedCidr {
  /** The network address as an unsigned 32-bit integer, masked to the prefix. */
  network: number;
  /** The prefix length, 0–32. */
  prefix: number;
}

function maskFor(prefix: number): number {
  if (prefix <= 0) return 0;
  if (prefix >= 32) return 0xffffffff;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

/** Parses an IPv4 CIDR string, returning null if it is not well-formed. */
export function parseCidr(cidr: string): ParsedCidr | null {
  const [address, prefixText, ...rest] = cidr.trim().split('/');
  if (address === undefined || prefixText === undefined || rest.length > 0) return null;

  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;

  const octets = address.split('.');
  if (octets.length !== 4) return null;

  let raw = 0;
  for (const octetText of octets) {
    if (!/^[0-9]{1,3}$/.test(octetText)) return null;
    const octet = Number(octetText);
    if (octet > 255) return null;
    raw = ((raw << 8) | octet) >>> 0;
  }

  return { network: (raw & maskFor(prefix)) >>> 0, prefix };
}

/** Returns true when `inner` is fully contained within `outer`. */
export function cidrContains(outer: string, inner: string): boolean {
  const outerParsed = parseCidr(outer);
  const innerParsed = parseCidr(inner);
  if (outerParsed === null || innerParsed === null) return false;
  if (innerParsed.prefix < outerParsed.prefix) return false;
  return ((innerParsed.network & maskFor(outerParsed.prefix)) >>> 0) === outerParsed.network;
}
