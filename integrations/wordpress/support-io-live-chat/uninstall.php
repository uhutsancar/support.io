<?php
/**
 * Removes the plugin's settings when it is deleted from the Plugins screen.
 *
 * @package SupportIoLiveChat
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'support_io_live_chat' );
