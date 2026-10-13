const { Node } = require("magmastream");

/**
 * Makes sure the bot never stays disconnected from a Lavalink server for good.
 *
 * magmastream reconnects by itself after a disconnect, but that loop can stop:
 *  - a connection attempt that never finishes (the server accepts the connection
 *    but never answers) waits forever, because no time limit is set;
 *  - the server can be removed from the bot entirely (after too many failed
 *    retries, or when an error happens while it's being reset).
 * Either way the bot silently keeps using the backup server until it restarts.
 *
 * This file adds a time limit to connection attempts, and a check every minute
 * that reconnects (or re-adds) any configured server whose reconnect loop stalled.
 */

// How long one connection attempt may take before it's given up and retried
const HANDSHAKE_TIMEOUT_MS = 20 * 1000;
// How often the watchdog checks the servers
const CHECK_EVERY_MS = 60 * 1000;

const originalConnect = Node.prototype.connect;

Node.prototype.connect = function () {
	if (this.connected) return;
	this.lastConnectAt = Date.now();
	originalConnect.call(this);

	const socket = this.socket;
	setTimeout(() => {
		if (this.socket === socket && socket?.readyState === socket.CONNECTING) {
			console.log(
				`[Lavalink] ${this.options.identifier}: no answer to the connection attempt after ` +
					`${HANDSHAKE_TIMEOUT_MS / 1000}s, retrying`
			);
			// Fails the attempt: magmastream sees a normal "closed" and schedules a retry
			socket.terminate();
		}
	}, HANDSHAKE_TIMEOUT_MS).unref();
};

// Also count a disconnect as "activity", so the watchdog gives magmastream's own
// reconnect (which first moves players to the backup) time to start
const originalClose = Node.prototype.close;
Node.prototype.close = function (...args) {
	this.lastConnectAt = Date.now();
	return originalClose.apply(this, args);
};

/** Starts the once-a-minute check. `nodeOptions` = the servers from config.js. */
function startNodeWatchdog(client, nodeOptions) {
	const timer = setInterval(() => {
		const manager = client.manager;
		if (!manager?.initiated) return; // not started yet (bot still logging in)

		for (const options of nodeOptions) {
			const name = options.identifier;
			const node = manager.nodes.get(name);

			// Removed from the bot (e.g. gave up after too many retries): add it back
			if (!node) {
				client.warn(`Node: ${name} | Was removed after failing; adding it back and connecting.`);
				manager.createNode(options).connect();
				continue;
			}
			if (node.connected) continue;

			// Not connected, and no attempt for well over the retry delay: the
			// reconnect loop has stopped, so start it again
			const quietFor = Date.now() - (node.lastConnectAt || 0);
			if (quietFor > 2 * options.retryDelay + 2 * HANDSHAKE_TIMEOUT_MS) {
				client.warn(
					`Node: ${name} | Not connected and no reconnect attempt for ${Math.round(quietFor / 1000)}s; reconnecting.`
				);
				clearTimeout(node.reconnectTimeout);
				node.reconnectAttempts = 1;
				if (node.socket) {
					node.socket.removeAllListeners();
					node.socket.on("error", () => {}); // terminate() may report an error; ignore it
					node.socket.terminate();
					node.socket = null;
				}
				node.connect();
			}
		}
	}, CHECK_EVERY_MS);
	timer.unref();
	return timer;
}

module.exports = { startNodeWatchdog, HANDSHAKE_TIMEOUT_MS };
