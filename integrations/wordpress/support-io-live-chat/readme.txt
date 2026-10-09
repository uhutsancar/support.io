=== Support.io Live Chat ===
Contributors: supportio
Tags: live chat, chat, customer support, help desk, chatbot
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Talk to your visitors while they are on your site. Paste one code and the Support.io chat bubble appears on every page.

== Description ==

Support.io puts a chat bubble on your site. Your visitors write; your team answers from the Support.io dashboard, the browser or the phone. Questions your FAQ already answers can be answered by the AI assistant, day and night, and anything it cannot answer goes straight to your team.

This plugin adds the chat to your WordPress site without editing your theme:

* Paste the installation code from your Support.io dashboard once; the chat appears on every page.
* The chat loads asynchronously in the footer, so it never holds up your pages.
* Optionally, introduce signed-in users (for example WooCommerce customers) by name and e-mail, so your team knows who they are talking to. With your site's identity key the dashboard marks them as verified customers.
* Change themes as often as you like; the chat stays.

You need a Support.io account. Sign up at https://__APP_DOMAIN__/register; there is a free plan.

== Installation ==

1. Install and activate the plugin.
2. In your Support.io dashboard, open Sites and copy the installation code from your site’s card.
3. In WordPress, go to Settings → Support.io, paste the code and save.
4. Make sure your site's address is in the list under Sites → Access in the dashboard. Reload your site: the chat bubble is in the bottom-right corner.

== Frequently Asked Questions ==

= Does the plugin slow my site down? =

No. The chat script loads asynchronously at the end of the page, after your content.

= Which details about my users are sent? =

None, unless you turn on "Signed-in users". Then the WordPress user ID, display name and e-mail of a signed-in user are passed to the chat on your pages. Visitors who are not signed in stay anonymous.

= Where do I find the identity key? =

In your Support.io dashboard under Sites → Access → Customer identity verification. The key is kept in your WordPress settings and is used on your server only; it never reaches the browser.

= How do I remove the chat? =

Under Settings → Support.io, tick “Remove the chat from my site” and save, or deactivate the plugin. Deleting the plugin removes its settings.

== External services ==

This plugin connects your site to Support.io, a live chat service, so that your visitors can chat with your team.

On every page of your site, the visitor's browser loads the chat script (widget.js) from the Support.io address in your installation code. When the visitor opens the chat or writes, the chat sends what they write, the page they are on, their browser language and, if you turn on "Signed-in users", the signed-in user's ID, display name and e-mail to Support.io. Nothing is sent from your WordPress server.

Support.io terms of service: https://__APP_DOMAIN__/en/terms
Support.io privacy policy: https://__APP_DOMAIN__/en/privacy

== Changelog ==

= 1.0.0 =
* First release: the chat on every page from the installation code, and optional introduction of signed-in users.
