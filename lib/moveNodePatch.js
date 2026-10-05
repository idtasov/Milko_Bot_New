const { Player } = require("magmastream");

/**
 * Safer version of magmastream's Player#moveNode (moving a player to another
 * Lavalink server, e.g. back to the main server after an outage).
 *
 * magmastream deletes the player on the old server first. While deleting it,
 * Lavalink sends a "track stopped" event, and if that arrives before the move
 * finishes, magmastream treats it like /skip or /stop: the song is skipped or
 * the queue ends. This version:
 *  1. points the player at the new server first, so events from the old server
 *     are ignored (magmastream drops events from servers a player isn't on),
 *  2. starts the song on the new server at the same position,
 *  3. only then deletes the old copy. If step 2 fails, the old server keeps playing.
 */
Player.prototype.moveNode = async function (identifier) {
	const node = this.manager.nodes.get(identifier);
	if (!node) throw new Error(`Node with identifier ${identifier} not found`);
	if (node === this.node) return this;

	const oldNode = this.node;
	const { sessionId, event: { token, endpoint } = {} } = this.voiceState || {};
	if (!sessionId || !token) throw new Error("Not connected to a voice channel yet");

	this.node = node;
	const result = await node.rest
		.updatePlayer({
			guildId: this.guildId,
			data: {
				paused: this.paused,
				volume: this.volume,
				position: this.position,
				encodedTrack: this.queue.current?.track,
				voice: { token, endpoint, sessionId },
			},
		})
		.catch(() => null);
	if (!result) {
		// Our REST patch returns null when the server didn't accept it
		this.node = oldNode;
		throw new Error(`${identifier} did not accept the player`);
	}

	await oldNode.rest.destroyPlayer(this.guildId).catch(() => {});
	await this.filters.updateFilters().catch(() => {});
	return this;
};

/**
 * Called by magmastream for every player when a server goes down. If one move
 * threw, magmastream would skip reconnecting to that server entirely, so errors
 * are logged here instead of being passed on.
 */
Player.prototype.autoMoveNode = async function () {
	const node = this.manager.useableNode;
	if (!node || node === this.node) return this;
	try {
		await this.moveNode(node.options.identifier);
		console.log(`Player: ${this.guildId} | Moved to ${node.options.identifier} while its server is down`);
	} catch (err) {
		console.log(`Player: ${this.guildId} | Could not move to ${node.options.identifier}: ${err.message}`);
	}
	return this;
};
