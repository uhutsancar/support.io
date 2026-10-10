// An address a customer gives us to call (a webhook, PRD-11) must not point
// into our own network (plan v10 TST-03, SSRF).
//
// Checked before every call, not when the address is saved: a name can
// resolve somewhere else tomorrow. The name is resolved once, every address
// it resolves to must be public, and the request then connects to that same
// address (`pinnedLookup`), so a second, different answer from DNS — the
// rebinding trick — is never used.
//
// Today nothing in the product calls a customer-given address; this is
// ready for the first thing that does.

import dns from 'dns';
import net from 'net';
import type { LookupAddress } from 'dns';

export class UnsafeUrlError extends Error {
  readonly code = 'UNSAFE_URL';
}

type Lookup = (hostname: string) => Promise<LookupAddress[]>;

const systemLookup: Lookup = (hostname) =>
  dns.promises.lookup(hostname, { all: true, verbatim: true });

/** Names that are ours or the cloud's, whatever they resolve to. */
const BLOCKED_NAMES = [
  /^localhost$/i,
  /\.localhost$/i,
  /^metadata\.google\.internal$/i,
  /\.internal$/i,
  /\.local$/i
];

function ipv4Private(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b, c] = octets;
  return (
    a === 0 || // current network and unspecified
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // shared address space
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88 && c === 99) || // deprecated 6to4 relay anycast
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    (a === 192 && b === 0 && c === 2) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) || // documentation networks
    a >= 224
  );
}

/** Canonical 16-byte IPv6 parser, including embedded dotted IPv4. */
function ipv6Bytes(input: string): Uint8Array | null {
  let value = input.toLowerCase().split('%', 1)[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (dotted) {
    if (net.isIP(dotted[1]) !== 4) return null;
    const bytes = dotted[1].split('.').map(Number);
    value = `${value.slice(0, dotted.index)}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  if ((value.match(/::/g) || []).length > 1) return null;
  const [leftRaw, rightRaw] = value.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const missing = value.includes('::') ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(Math.max(0, missing)).fill('0'), ...right];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  const out = new Uint8Array(16);
  groups.forEach((group, index) => {
    const n = parseInt(group, 16);
    out[index * 2] = n >> 8;
    out[index * 2 + 1] = n & 0xff;
  });
  return out;
}

function inPrefix(bytes: Uint8Array, prefix: readonly number[], bits: number): boolean {
  const whole = Math.floor(bits / 8);
  for (let i = 0; i < whole; i += 1) if (bytes[i] !== prefix[i]) return false;
  const remainder = bits % 8;
  if (!remainder) return true;
  const mask = (0xff << (8 - remainder)) & 0xff;
  return (bytes[whole] & mask) === ((prefix[whole] ?? 0) & mask);
}

function ipv6Private(ip: string): boolean {
  const bytes = ipv6Bytes(ip);
  if (!bytes) return true;

  // Only globally-routable unicast (2000::/3) is eligible. Then remove the
  // special-purpose ranges inside it. Translation/tunnel prefixes are denied
  // instead of attempting to reason about their embedded destination.
  if (!inPrefix(bytes, [0x20], 3)) return true;
  const denied: Array<[readonly number[], number]> = [
    [[0x20, 0x01, 0x00, 0x00], 32], // Teredo
    [[0x20, 0x01, 0x00, 0x02], 48], // benchmarking
    [[0x20, 0x01, 0x00, 0x10], 28], // ORCHID
    [[0x20, 0x01, 0x00, 0x20], 28], // ORCHIDv2
    [[0x20, 0x01, 0x0d, 0xb8], 32], // documentation
    [[0x20, 0x02], 16] // 6to4
  ];
  return denied.some(([prefix, bits]) => inPrefix(bytes, prefix, bits));
}

/** Whether an IP address is loopback, private, link-local or otherwise not on the internet. */
export function isPrivateAddress(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return ipv4Private(ip);
  if (kind === 6) return ipv6Private(ip);
  return true;
}

export interface SafeTarget {
  url: URL;
  /** The address the request must connect to. */
  address: string;
  family: 4 | 6;
}

/**
 * Checks a customer-given address and returns where to connect, or throws
 * UnsafeUrlError. Only http(s) on the standard ports, no user:password, and
 * only public addresses.
 */
export async function safeOutboundUrl(
  raw: string,
  lookup: Lookup = systemLookup
): Promise<SafeTarget> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Not a valid address');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Only http and https addresses are allowed');
  }
  if (url.username || url.password)
    throw new UnsafeUrlError('Addresses with a password are not allowed');
  if (url.port && !['80', '443'].includes(url.port)) {
    throw new UnsafeUrlError('Only the standard ports are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (BLOCKED_NAMES.some((rx) => rx.test(host)))
    throw new UnsafeUrlError('That address is not allowed');

  let addresses: LookupAddress[];
  if (net.isIP(host)) {
    addresses = [{ address: host, family: net.isIP(host) }];
  } else {
    try {
      addresses = await lookup(host);
    } catch {
      throw new UnsafeUrlError('The address does not resolve');
    }
  }
  if (!addresses.length) throw new UnsafeUrlError('The address does not resolve');
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('That address points into a private network');
  }
  const first = addresses[0];
  return { url, address: first.address, family: first.family === 6 ? 6 : 4 };
}

/**
 * The `lookup` option for http(s).request that always answers with the
 * address safeOutboundUrl checked, so DNS is not asked a second time.
 */
export function pinnedLookup(target: SafeTarget) {
  return (
    _hostname: string,
    options: { all?: boolean } | null,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number
    ) => void
  ): void => {
    // Newer Node asks for every address at once (options.all).
    if (options && options.all) {
      callback(null, [{ address: target.address, family: target.family }]);
    } else {
      callback(null, target.address, target.family);
    }
  };
}
