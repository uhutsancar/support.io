// Paddle.js, loaded only on the checkout page and only when the owner opens
// the payment screen. The client token is the one Paddle value meant for a
// browser (it comes from GET/POST /api/billing); nothing secret is here.
//
// Paddle.Initialize may run once per page, and its event callback is fixed
// at that moment, so events are forwarded to whichever handler the page set.

import type { CheckoutSession } from '../types/api';

const SCRIPT_SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';

interface PaddleEvent {
  name?: string;
  data?: unknown;
}

interface PaddleGlobal {
  Environment: { set(env: string): void };
  Initialize(options: { token: string; eventCallback?: (event: PaddleEvent) => void }): void;
  Checkout: {
    open(options: {
      items: Array<{ priceId: string; quantity: number }>;
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: Record<string, unknown>;
    }): void;
  };
}

let loading: Promise<PaddleGlobal> | null = null;
let initialized = false;
let handler: ((event: PaddleEvent) => void) | null = null;

function loadScript(): Promise<PaddleGlobal> {
  loading ??= new Promise<PaddleGlobal>((resolve, reject) => {
    const existing = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
    if (existing) return resolve(existing);
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const paddle = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
      if (paddle) resolve(paddle);
      else reject(new Error('Paddle.js did not load'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Paddle.js could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Opens Paddle's overlay checkout for the session the server prepared. */
export async function openCheckout(
  session: CheckoutSession,
  locale: string,
  onEvent: (event: PaddleEvent) => void
): Promise<void> {
  const paddle = await loadScript();
  handler = onEvent;
  if (!initialized) {
    if (session.environment === 'sandbox') paddle.Environment.set('sandbox');
    paddle.Initialize({
      token: session.clientToken,
      eventCallback: (event) => handler?.(event)
    });
    initialized = true;
  }
  paddle.Checkout.open({
    items: [{ priceId: session.priceId, quantity: 1 }],
    customer: { email: session.customerEmail },
    customData: session.customData,
    // showAddTaxId: a business buyer adds its company name and tax number,
    // which Paddle prints on the invoice (BIL-06).
    settings: { displayMode: 'overlay', theme: 'light', locale, showAddTaxId: true }
  });
}

/** Stops forwarding events to a page that has gone. */
export function releaseCheckout(): void {
  handler = null;
}
