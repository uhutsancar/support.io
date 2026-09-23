// The demo shop's side of identity verification and order lookup.
//
// Shared by the seeder (which stores the keys, sealed, on the demo site), the
// demo order service (scripts/demoOrderService.ts) and the development-only
// endpoint the demo page signs its customer in with (routes/widget.ts).
//
// These keys are published in the repository, which is exactly why they only
// ever belong to the demo tenant and to development. Nothing in production
// reads them: the endpoint is not mounted there and the service is a script
// the production image does not contain.

export const DEMO_SITE_KEY = 'demo-site-key-0000-1111-2222';

export const DEMO_IDENTITY_SECRET = 'demo-identity-key-for-local-development-only';
export const DEMO_ORDER_SIGNING_SECRET = 'demo-order-signing-key-for-local-development-only';

/** The demo service listens inside the backend container, next to the API. */
export const DEMO_ORDER_SERVICE_PORT = Number(process.env.DEMO_ORDERS_PORT) || 5055;
// 127.0.0.1 rather than localhost: inside the container localhost resolves to
// ::1 first, and the service listens on IPv4 only.
export const DEMO_ORDER_SERVICE_URL = `http://127.0.0.1:${DEMO_ORDER_SERVICE_PORT}/support-io/orders`;

/** The customer the demo page signs in as; they have orders in the demo service. */
export const DEMO_CUSTOMER = {
  userId: 'demo-customer-1',
  name: 'Deniz Demo',
  email: 'deniz@demo.support.io'
} as const;
