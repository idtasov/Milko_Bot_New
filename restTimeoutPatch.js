const axios = require("axios");
const { Rest } = require("magmastream");

// How long to wait for a Lavalink server to answer an HTTP request (search, play, etc.)
const REQUEST_TIMEOUT_MS = 10 * 1000;

/**
 * magmastream 2.8 sends HTTP requests to Lavalink with no timeout and hides why
 * they failed. With unreliable public servers that means `/play` can hang on
 * "Searching..." forever. This replaces its request method with the same logic
 * plus a timeout and a log line explaining any failure.
 */
Rest.prototype.request = async function (method, endpoint, body) {
	const nodeName = this.node.options.identifier;
	this.manager.emit("debug", `[REST] ${method} api call for endpoint: ${endpoint} with data: ${JSON.stringify(body)}`);

	try {
		const response = await axios({
			method,
			url: this.url + endpoint,
			headers: {
				"Content-Type": "application/json",
				Authorization: this.password,
			},
			data: body,
			timeout: REQUEST_TIMEOUT_MS,
		});
		return response.data;
	} catch (error) {
		// No answer at all: server down, blocked, or slower than the timeout
		if (!error.response) {
			console.error(`[Lavalink] ${nodeName}: no response to ${method} ${endpoint.split("?")[0]} (${error.message})`);
			return null;
		}

		// Normal when a player was already gone on the server
		if (error.response.data?.message === "Guild not found") {
			return [];
		}

		// Server answered with an error, e.g. 401 = wrong password
		console.error(
			`[Lavalink] ${nodeName}: ${method} ${endpoint.split("?")[0]} failed with HTTP ${error.response.status}` +
				(error.response.data?.message ? ` (${error.response.data.message})` : "")
		);

		// Same as magmastream: a 404 usually means the session expired, so reconnect
		if (error.response.status === 404) {
			await this.node.destroy();
			this.node.manager.createNode(this.node.options).connect();
		}
		return null;
	}
};
