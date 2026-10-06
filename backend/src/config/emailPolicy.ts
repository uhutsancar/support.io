// Which addresses may open an account (plan v10 SEC-06).
//
// Throwaway inboxes are how sign-up abuse scales: an address that exists for
// ten minutes verifies an account and is gone before anyone could reach it.
// The list is the public, CC0 disposable-email-domains blocklist kept in the
// repository (config/data); nothing is looked up over the network, and a
// subdomain of a listed domain counts as listed.

import fs from 'fs';
import path from 'path';

let domains: Set<string> | null = null;

function disposableDomains(): Set<string> {
  if (!domains) {
    const file = path.join(__dirname, 'data', 'disposable-domains.txt');
    domains = new Set(
      fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith('#'))
    );
  }
  return domains;
}

/** True when the address belongs to a known throwaway-mail service. */
export function isDisposableEmail(email: string): boolean {
  const domain = String(email).toLowerCase().split('@')[1];
  if (!domain) return false;
  const list = disposableDomains();
  const labels = domain.split('.');
  // mail.example.com is checked as itself, then example.com.
  for (let i = 0; i < labels.length - 1; i++) {
    if (list.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}
