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
  const [a, b] = ip.split('.').map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipv6Private(ip: string): boolean {
  const lower = ip.toLowerCase();
  // An IPv4 address inside IPv6 (::ffff:a.b.c.d), which URL parsing turns
  // into hex (::ffff:7f00:1): judged as the IPv4 address it is.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return ipv4Private(mapped[1]);
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return ipv4Private(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return (
    lower === '::' ||
    lower === '::1' ||
    /^f[cd][0-9a-f]{2}:/.test(lower) ||
    /^fe[89ab][0-9a-f]:/.test(lower) ||
    /^ff[0-9a-f]{2}:/.test(lower) ||
    /^64:ff9b::/.test(lower) ||
    /^2001:db8:/.test(lower)
  );
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
