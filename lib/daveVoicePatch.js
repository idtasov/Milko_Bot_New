const { Rest } = require("magmastream");

/**
 * Discord requires end-to-end encrypted voice (the "DAVE" protocol) since March 2026.
 * Lavalink servers that support DAVE need the voice *channel* ID in every voice
 * update, otherwise the track "starts" on the server but no audio reaches Discord.
 *
 * magmastream 2.8 only sends { token, endpoint, sessionId }, so this wraps the one
 * method all voice updates go through (initial join, reconnects and moving to the
 * backup node) and adds `channelId` from the player.
 */
const originalUpdatePlayer = Rest.prototype.updatePlayer;

Rest.prototype.updatePlayer = function (options) {
	const voice = options?.data?.voice;
	if (voice && !voice.channelId) {
		const player = this.manager.players.get(options.guildId);
		if (player?.voiceChannelId) {
			voice.channelId = player.voiceChannelId;
		}
	}
	return originalUpdatePlayer.call(this, options);
};
