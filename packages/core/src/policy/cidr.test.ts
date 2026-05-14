import { describe, it, expect } from 'vitest';
import { parseCidr, cidrContains } from './cidr';

describe('parseCidr', () => {
  it('parses a well-formed CIDR and masks the network to the prefix', () => {
    expect(parseCidr('10.0.1.5/16')).toEqual({ network: (10 << 24) >>> 0, prefix: 16 });
    expect(parseCidr('0.0.0.0/0')).toEqual({ network: 0, prefix: 0 });
  });

  it('rejects malformed input', () => {
    expect(parseCidr('10.0.0.0')).toBeNull();
    expect(parseCidr('10.0.0.0/33')).toBeNull();
    expect(parseCidr('10.0.0.256/24')).toBeNull();
    expect(parseCidr('10.0.0/24')).toBeNull();
    expect(parseCidr('10.0.0.0/24/8')).toBeNull();
    expect(parseCidr('not-an-ip/24')).toBeNull();
  });
});

describe('cidrContains', () => {
  it('recognizes a sub-range as contained', () => {
    expect(cidrContains('10.0.0.0/16', '10.0.1.0/24')).toBe(true);
    expect(cidrContains('10.0.0.0/8', '10.255.255.0/24')).toBe(true);
    expect(cidrContains('0.0.0.0/0', '192.168.1.0/24')).toBe(true);
  });

  it('treats an equal range as contained', () => {
    expect(cidrContains('10.0.0.0/16', '10.0.0.0/16')).toBe(true);
  });

  it('rejects a range that is not contained', () => {
    expect(cidrContains('192.168.0.0/16', '10.0.0.0/24')).toBe(false);
    expect(cidrContains('10.0.0.0/24', '10.0.0.0/16')).toBe(false); // wider than the outer
    expect(cidrContains('10.0.0.0/16', '10.1.0.0/24')).toBe(false);
  });

  it('rejects malformed operands', () => {
    expect(cidrContains('garbage', '10.0.0.0/24')).toBe(false);
    expect(cidrContains('10.0.0.0/16', 'garbage')).toBe(false);
  });
});
