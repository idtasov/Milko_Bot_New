const axios = require("axios");

/**
 * Hands the YouTube login (OAuth refresh token) to our own Lavalink server after
 * the bot connects to it.
 *
 * If the token is in Lavalink's application.yml instead, the YouTube plugin renews
 * the login with Google while Lavalink starts, and when Google answers slowly
 * Lavalink fails to start at all. Sending it from here means Lavalink always
 * starts, and a slow answer is simply retried.
 *
 * Only nodes with `youtubeRefreshToken` set in config.js get the token (our own
 * server), so it is never sent to a public server run by someone else.
 */
const RETRY_DELAY_MS = 30 * 1000;
const MAX_ATTEMPTS = 10;

async function sendYoutubeToken(client, node, attempt = 1) {
	const token = node.options.youtubeRefreshToken;
	if (!token || !node.connected) return;
	const name = node.options.identifier;

	try {
		// Called directly rather than via node.rest, so an error here can never
		// trigger magmastream's "404 = expired session, reconnect" handling.
		await axios.post(
			`${node.rest.url}/youtube`,
			{ refreshToken: token, skipInitialization: true },
			{ headers: { Authorization: node.options.password }, timeout: 20 * 1000 }
		);
		client.log(`Node: ${name} | YouTube login sent to the server.`);
	} catch (err) {
		const why = err.response ? `HTTP ${err.response.status}` : err.message;
		if (attempt >= MAX_ATTEMPTS) {
			client.warn(`Node: ${name} | Could not send the YouTube login (${why}); giving up until the next reconnect.`);
			return;
		}
		client.warn(`Node: ${name} | Sending the YouTube login failed (${why}); retrying in ${RETRY_DELAY_MS / 1000}s.`);
		setTimeout(() => sendYoutubeToken(client, node, attempt + 1), RETRY_DELAY_MS);
	}
}

module.exports = { sendYoutubeToken };
