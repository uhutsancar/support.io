// The demo shop's side of identity verification.
//
// Shared by the seeder (which stores the key, sealed, on the demo site) and
// the development-only endpoint the demo page signs its customer in with
// (routes/widget.ts).
//
// The key is published in the repository, which is exactly why it only ever
// belongs to the demo tenant and to development. Nothing in production reads
// it: the endpoint is not mounted there.

export const DEMO_SITE_KEY = 'demo-site-key-0000-1111-2222';

export const DEMO_IDENTITY_SECRET = 'demo-identity-key-for-local-development-only';
/** The customer the demo page signs in as. */
export const DEMO_CUSTOMER = {
  userId: 'demo-customer-1',
  name: 'Deniz Demo',
  email: 'deniz@demo.support.io'
} as const;
