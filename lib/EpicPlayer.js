const { Message } = require("discord.js");
const { Structure } = require("magmastream");
const Client = require("./DiscordMusicBot");

Structure.extend(
	"Player",
	(Player) =>
		class extends Player {
			constructor(...props) {
				super(...props);
				this.twentyFourSeven = false;
			}

			/**
			 * Searches like magmastream's Player#search, but if a different Lavalink server
			 * found the tracks (because this player's server failed the search), moves the
			 * player to that server first. Otherwise the tracks would be queued on a server
			 * that just showed it can't load them, and playback would silently fail.
			 */
			async search(query, requester) {
				const res = await super.search(query, requester);
				const foundOn = res.node;
				if (foundOn && foundOn !== this.node) {
					try {
						await this.moveNode(foundOn.options.identifier);
						console.log(`Player: ${this.guildId} | Moved to ${foundOn.options.identifier}, which found the tracks`);
					} catch (err) {
						console.log(`Player: ${this.guildId} | Could not move to ${foundOn.options.identifier}: ${err.message}`);
					}
				}
				return res;
			}
			
			/**
			 * Set's (maps) the client's resume message so it can be deleted afterwards
			 * @param {Client} client
			 * @param {Message} message
			 * @returns the Set Message
			 */
			setResumeMessage(client, message) {
				if (this.pausedMessage && !client.isMessageDeleted(this.pausedMessage)) {
					this.pausedMessage.delete().catch(() => {}); // may already be deleted by magmastream or a user
					client.markMessageAsDeleted(this.pausedMessage);
				}
				return (this.resumeMessage = message);
			}
			
			/**
			 * Set's (maps) the client's paused message so it can be deleted afterwards
			 * @param {Client} client
			 * @param {Message} message
			 * @returns
			 */
			setPausedMessage(client, message) {
				if (this.resumeMessage && !client.isMessageDeleted(this.resumeMessage)) {
					this.resumeMessage.delete().catch(() => {}); // may already be deleted by magmastream or a user
					client.markMessageAsDeleted(this.resumeMessage);
				}
				return (this.pausedMessage = message);
			}
			
			/**
			 * Set's (maps) the client's now playing message so it can be deleted afterwards
			 * @param {Client} client
			 * @param {Message} message
			 * @returns
			 */
			setNowplayingMessage(client, message) {
				if (this.nowPlayingMessage && !client.isMessageDeleted(this.nowPlayingMessage)) {
					this.nowPlayingMessage.delete().catch(() => {}); // may already be deleted by magmastream or a user
					client.markMessageAsDeleted(this.nowPlayingMessage);
				}
				return (this.nowPlayingMessage = message);
			}
		},
);
