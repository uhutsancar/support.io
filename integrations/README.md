# Install channels

Ready-made ways for a customer to put the chat on their site without touching
code (plan v10 PRD-13). All three load the same `widget.js` with the site's
key; nothing here talks to our API on its own.

| Channel | Folder | Tested | To publish |
| --- | --- | --- | --- |
| WordPress plugin | `wordpress/support-io-live-chat` | Real WordPress 7.1 (Docker) with `e2e/tests/wordpress-plugin.spec.ts`; WordPress.org Plugin Check | [SAHİP] WordPress.org account, submit the zip, then SVN |
| Google Tag Manager template | `gtm` | `e2e/tests/gtm-template.spec.ts`: file structure and permissions, and the template's code in a real page with GTM's three calls written out. GTM's own sandbox and the `___TESTS___` scenarios run only inside Tag Manager | [SAHİP] public GitHub repository for the template, then the Community Template Gallery |
| Shopify app embed | `shopify/extensions/support-io-chat` | Shopify Theme Check (app-extension rules) only; not run in a store | [SAHİP] Shopify Partner account and an app to hold the extension |

Turkish e-commerce platforms (ikas, Ticimax, IdeaSoft, T-Soft) have no app to
build: each has a box for site-wide code, and the installation guide
(`/dokumantasyon`, Platforms) has the steps, taken from each platform's own
help pages. Screenshots of those admin screens need an account on each
platform [SAHİP].

## Before publishing

The production domain is not chosen yet (SAHİP-05), so the files say
`__APP_DOMAIN__` where it goes. Once it is:

```sh
node integrations/release.mjs support.example.com
```

writes `integrations/dist/` (ignored by Git) with the domain filled in.

**WordPress.** Zip `dist/wordpress/support-io-live-chat` (the folder itself
at the root of the zip) and submit it at wordpress.org/plugins/developers/add.
Before that: set `Contributors:` in `readme.txt` to the WordPress.org user
name, raise `Tested up to:` to the current WordPress version, run Plugin Check
again. The one warning it gives, `load_plugin_textdomain`, is deliberate: the
Turkish translation ships inside the plugin so a zip install is Turkish from
the first day.

**GTM.** Put `dist/gtm/template.tpl` and `metadata.yaml` at the root of a
public repository, put that commit's SHA into `metadata.yaml`, and submit the
repository in the Community Template Gallery. Import the template into a
container first and run its tests (Templates → the template → Tests).

**Shopify.** Create an app in the Partner dashboard, copy
`dist/shopify/extensions/support-io-chat` into the app's `extensions/` and
run `shopify app deploy`. Merchants then turn it on under Online Store →
Themes → Customize → App embeds.

## Trying the plugin locally

`wordpress/docker-compose.test.yml` starts a throw-away WordPress on
127.0.0.1:8089 with the plugin folder mounted read-only; its header lists
the commands. The test then runs against the local stack:

```sh
cd e2e && WP_URL=http://localhost:8089 npx playwright test tests/wordpress-plugin.spec.ts
```

The plugin accepts an `http://localhost` widget address only so this works;
everywhere else the address must be https.
