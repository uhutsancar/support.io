<?php
/**
 * Plugin Name:       Support.io Live Chat
 * Description:       Adds the Support.io live chat bubble to every page of your site. Paste the installation code from your Support.io dashboard; no theme editing needed.
 * Version:           1.0.0
 * Requires at least: 6.5
 * Requires PHP:      7.4
 * Author:            Support.io
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       support-io-live-chat
 * Domain Path:       /languages
 *
 * @package SupportIoLiveChat
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The plugin: one settings page and one script tag.
 *
 * The settings page takes the installation code the Support.io dashboard
 * shows (Sites → the site's card → Installation code) and keeps only the two things in it that matter:
 * the address the chat is served from and the site key. The page then loads
 * that address's widget.js with the key, asynchronously, in the footer.
 *
 * Optionally, a signed-in WordPress user is introduced to the chat by name and
 * e-mail, signed with the site's identity key so the dashboard can trust it.
 */
final class Support_IO_Live_Chat {

	const VERSION = '1.0.0';
	const OPTION  = 'support_io_live_chat';
	const HANDLE  = 'support-io-live-chat';
	const PAGE    = 'support-io-live-chat';

	/** Set in the browser while a signed-in user is introduced to the chat. */
	const MARKER = 'supportio_wp_identified';

	/**
	 * Hooks the plugin in.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'load_textdomain' ) );
		add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
		add_action( 'admin_menu', array( __CLASS__, 'add_page' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'script_loader_tag', array( __CLASS__, 'tag' ), 10, 2 );
		add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), array( __CLASS__, 'action_links' ) );
	}

	/**
	 * Loads the bundled translations (Turkish ships with the plugin).
	 */
	public static function load_textdomain() {
		load_plugin_textdomain( 'support-io-live-chat', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}

	/**
	 * The saved settings, with every key present.
	 *
	 * @return array{origin: string, site_key: string, identify: bool, identity_secret: string}
	 */
	public static function options() {
		$saved = get_option( self::OPTION, array() );
		return wp_parse_args(
			is_array( $saved ) ? $saved : array(),
			array(
				'origin'          => '',
				'site_key'        => '',
				'identify'        => false,
				'identity_secret' => '',
			)
		);
	}

	/**
	 * The address and site key in an installation code, or null.
	 *
	 * Accepts the code exactly as the dashboard shows it. The script address
	 * must be https (plain http only for a local test server) and end in
	 * /widget.js; the site key is the one in data-site-key.
	 *
	 * @param string $code What was pasted.
	 * @return array{origin: string, site_key: string}|null
	 */
	public static function parse_install_code( $code ) {
		if ( ! preg_match( '/\bsrc\s*=\s*["\']([^"\']+)["\']/i', $code, $src ) ) {
			return null;
		}
		if ( ! preg_match( '/\bdata-site-key\s*=\s*["\']([A-Za-z0-9-]{8,64})["\']/i', $code, $key ) ) {
			return null;
		}
		$url = wp_parse_url( trim( $src[1] ) );
		if ( empty( $url['scheme'] ) || empty( $url['host'] ) || empty( $url['path'] ) ) {
			return null;
		}
		$scheme = strtolower( $url['scheme'] );
		$host   = strtolower( $url['host'] );
		$local  = in_array( $host, array( 'localhost', '127.0.0.1' ), true );
		if ( ! preg_match( '/^[a-z0-9.-]+$/', $host ) || '/widget.js' !== $url['path'] ) {
			return null;
		}
		if ( 'https' !== $scheme && ! ( 'http' === $scheme && $local ) ) {
			return null;
		}
		$port = isset( $url['port'] ) ? ':' . (int) $url['port'] : '';
		return array(
			'origin'   => $scheme . '://' . $host . $port,
			'site_key' => $key[1],
		);
	}

	/**
	 * Registers the one option and its sanitizer.
	 */
	public static function register_settings() {
		register_setting(
			self::PAGE,
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => array(),
			)
		);
	}

	/**
	 * Keeps what the form sent that is valid. An empty code box keeps the
	 * saved code; an invalid one leaves it in place and says so.
	 *
	 * @param mixed $input The submitted fields.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$out = self::options();
		if ( ! is_array( $input ) ) {
			return $out;
		}

		$code = isset( $input['code'] ) ? trim( (string) $input['code'] ) : '';
		if ( ! empty( $input['remove'] ) ) {
			$out['origin']   = '';
			$out['site_key'] = '';
		} elseif ( '' !== $code ) {
			$parsed = self::parse_install_code( $code );
			if ( null === $parsed ) {
				self::error(
					'invalid_code',
					__( 'That is not a Support.io installation code. Copy the whole code from your Support.io dashboard (Sites → your site’s card → Installation code) and paste it here.', 'support-io-live-chat' )
				);
			} else {
				$out['origin']   = $parsed['origin'];
				$out['site_key'] = $parsed['site_key'];
			}
		}

		$out['identify'] = ! empty( $input['identify'] );
		if ( ! empty( $input['forget_secret'] ) ) {
			$out['identity_secret'] = '';
		} elseif ( isset( $input['identity_secret'] ) && '' !== trim( (string) $input['identity_secret'] ) ) {
			$secret = trim( (string) $input['identity_secret'] );
			if ( preg_match( '/^[\x21-\x7e]{16,200}$/', $secret ) ) {
				$out['identity_secret'] = $secret;
			} else {
				self::error(
					'invalid_secret',
					__( 'The identity key looks wrong. Copy it again from Sites → Access → Customer identity verification.', 'support-io-live-chat' )
				);
			}
		}
		return $out;
	}

	/**
	 * Reports a problem with the form once. WordPress runs the sanitizer twice
	 * when the option is saved for the first time; the message must not show
	 * twice. (WordPress prints the messages itself on a Settings page.)
	 *
	 * @param string $code    The message's id.
	 * @param string $message The message.
	 */
	private static function error( $code, $message ) {
		foreach ( get_settings_errors( self::OPTION ) as $existing ) {
			if ( $existing['code'] === $code ) {
				return;
			}
		}
		add_settings_error( self::OPTION, $code, $message );
	}

	/**
	 * Adds Settings → Support.io.
	 */
	public static function add_page() {
		add_options_page(
			__( 'Support.io Live Chat', 'support-io-live-chat' ),
			'Support.io',
			'manage_options',
			self::PAGE,
			array( __CLASS__, 'render_page' )
		);
	}

	/**
	 * A "Settings" link next to the plugin on the Plugins screen.
	 *
	 * @param string[] $links The existing links.
	 * @return string[]
	 */
	public static function action_links( $links ) {
		$url = admin_url( 'options-general.php?page=' . self::PAGE );
		array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'support-io-live-chat' ) . '</a>' );
		return $links;
	}

	/**
	 * The settings page.
	 */
	public static function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$o    = self::options();
		$name = self::OPTION;
		?>
		<div class="wrap">
			<h1><?php esc_html_e( 'Support.io Live Chat', 'support-io-live-chat' ); ?></h1>
			<?php if ( '' !== $o['site_key'] ) : ?>
				<div class="notice notice-success inline"><p>
					<?php
					printf(
						/* translators: %s: the address the chat is served from */
						esc_html__( 'The chat bubble is on every page of your site, served from %s.', 'support-io-live-chat' ),
						'<code>' . esc_html( $o['origin'] ) . '</code>'
					);
					?>
					<a href="<?php echo esc_url( $o['origin'] . '/dashboard' ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Open your Support.io dashboard', 'support-io-live-chat' ); ?></a>
				</p></div>
			<?php endif; ?>
			<form method="post" action="options.php">
				<?php settings_fields( self::PAGE ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="support-io-code"><?php esc_html_e( 'Installation code', 'support-io-live-chat' ); ?></label></th>
						<td>
							<textarea id="support-io-code" name="<?php echo esc_attr( $name ); ?>[code]" rows="4" class="large-text code" spellcheck="false" aria-describedby="support-io-code-help"></textarea>
							<p class="description" id="support-io-code-help">
								<?php
								if ( '' !== $o['site_key'] ) {
									printf(
										/* translators: %s: the start of the saved site key */
										esc_html__( 'Saved site key: %s. Paste a new code only to change it.', 'support-io-live-chat' ),
										'<code>' . esc_html( substr( $o['site_key'], 0, 8 ) ) . '…</code>'
									);
								} else {
									esc_html_e( 'In your Support.io dashboard, open Sites and copy the installation code from this site’s card. Paste it here as it is.', 'support-io-live-chat' );
								}
								?>
							</p>
							<?php if ( '' !== $o['site_key'] ) : ?>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[remove]" value="1" /> <?php esc_html_e( 'Remove the chat from my site', 'support-io-live-chat' ); ?></label>
							<?php endif; ?>
						</td>
					</tr>
					<tr>
						<th scope="row"><?php esc_html_e( 'Signed-in users', 'support-io-live-chat' ); ?></th>
						<td>
							<label>
								<input type="checkbox" name="<?php echo esc_attr( $name ); ?>[identify]" value="1" <?php checked( $o['identify'] ); ?> />
								<?php esc_html_e( 'Tell your team who they are talking to: the name and e-mail of a signed-in user are passed to the chat.', 'support-io-live-chat' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'Mention this in your privacy policy. Visitors who are not signed in stay anonymous.', 'support-io-live-chat' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="support-io-secret"><?php esc_html_e( 'Identity key (optional)', 'support-io-live-chat' ); ?></label></th>
						<td>
							<input type="password" id="support-io-secret" name="<?php echo esc_attr( $name ); ?>[identity_secret]" value="" class="regular-text" autocomplete="off" aria-describedby="support-io-secret-help" />
							<p class="description" id="support-io-secret-help">
								<?php
								if ( '' !== $o['identity_secret'] ) {
									esc_html_e( 'A key is saved. Leave the box empty to keep it.', 'support-io-live-chat' );
								} else {
									esc_html_e( 'With the key from Sites → Access → Customer identity verification, your team sees a "verified customer" badge and the customer finds earlier conversations on any device. The key stays on your server.', 'support-io-live-chat' );
								}
								?>
							</p>
							<?php if ( '' !== $o['identity_secret'] ) : ?>
								<label><input type="checkbox" name="<?php echo esc_attr( $name ); ?>[forget_secret]" value="1" /> <?php esc_html_e( 'Remove the saved key', 'support-io-live-chat' ); ?></label>
							<?php endif; ?>
						</td>
					</tr>
				</table>
				<?php submit_button(); ?>
			</form>
		</div>
		<?php
	}

	/**
	 * Loads the chat on the site's pages.
	 */
	public static function enqueue() {
		$o = self::options();
		if ( '' === $o['origin'] || '' === $o['site_key'] ) {
			return;
		}
		wp_enqueue_script(
			self::HANDLE,
			$o['origin'] . '/widget.js',
			array(),
			self::VERSION,
			array(
				'in_footer' => true,
				'strategy'  => 'async',
			)
		);
		if ( ! $o['identify'] ) {
			return;
		}
		if ( is_user_logged_in() ) {
			$user = wp_get_current_user();
			$who  = array(
				'userId' => (string) $user->ID,
				'name'   => $user->display_name,
				'email'  => $user->user_email,
			);
			if ( '' !== $o['identity_secret'] ) {
				$who['userHash'] = hash_hmac( 'sha256', (string) $user->ID, $o['identity_secret'] );
			}
			$js = '(function(){var s=window.SupportChat=window.SupportChat||{q:[]};s.q.push(["identify",'
				. wp_json_encode( $who, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE )
				. ']);try{localStorage.setItem("' . self::MARKER . '","1")}catch(e){}})();';
		} else {
			// Signed out since the last page: the chat forgets the user, so the
			// next person on this computer does not see their conversation.
			$js = '(function(){try{if(localStorage.getItem("' . self::MARKER . '")){localStorage.removeItem("'
				. self::MARKER . '");var s=window.SupportChat=window.SupportChat||{q:[]};s.q.push(["logout"]);}}catch(e){}})();';
		}
		wp_add_inline_script( self::HANDLE, $js, 'before' );
	}

	/**
	 * Puts the site key on the chat's script tag.
	 *
	 * @param string $tag    The HTML for the script and its inline parts.
	 * @param string $handle The script's handle.
	 * @return string
	 */
	public static function tag( $tag, $handle ) {
		if ( self::HANDLE !== $handle ) {
			return $tag;
		}
		$o = self::options();
		return str_replace( ' src=', ' data-site-key="' . esc_attr( $o['site_key'] ) . '" src=', $tag );
	}
}

Support_IO_Live_Chat::init();
