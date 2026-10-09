// `npm run push:keys` — a fresh VAPID key pair for Web Push (plan v10
// PRD-09), printed as the two lines .env.production needs. Run it once per
// environment; changing the keys later unsubscribes every browser.

import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
process.stdout.write(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`);
