// Every value that is secret or differs between hosts is read from environment
// variables, so the bot can run on free cloud hosts (Render, Koyeb, etc.) where
// you set variables in the host's dashboard instead of editing this file.
// For local runs, copy `.env.example` to `.env` and fill it in.

/** Reads an env var as a boolean ("true"/"1"/"yes"), falling back to `def` when unset. */
const bool = (name, def) => {
	const v = process.env[name];
	if (v === undefined || v === "") return def;
	return ["true", "1", "yes"].includes(v.toLowerCase());
};

/** Reads an env var as a number, falling back to `def` when unset or invalid. */
const num = (name, def) => {
	const v = parseInt(process.env[name], 10);
	return Number.isNaN(v) ? def : v;
};

/** Reads an env var that must be one of `allowed` (case-insensitive), falling back to `def`. */
const oneOf = (name, allowed, def) => {
	const v = (process.env[name] || "").trim();
	return allowed.find((a) => a.toLowerCase() === v.toLowerCase()) || def;
};

// Hosts tell the app which port to listen on via PORT; 4200 is the local default.
const port = num("PORT", 4200);

// Public URL of the bot's web server. Render sets RENDER_EXTERNAL_URL automatically.
const website = (
	process.env.WEBSITE ||
	process.env.RENDER_EXTERNAL_URL ||
	`http://localhost:${port}`
).replace(/\/+$/, ""); // strip trailing slashes

module.exports = {
	helpCmdPerPage: 10, //- Number of commands per page of help command
	lyricsMaxResults: 5, //- Number of results for lyrics command (Do not touch this value if you don't know what you are doing)
	adminId: process.env.ADMIN_ID || "UserId", //- Discord ID of the admin of the bot
	token: process.env.TOKEN || process.env.token || "", //- Bot's Token
	clientId: process.env.CLIENT_ID || process.env.clientId || "", //- ID of the bot
	clientSecret: process.env.CLIENT_SECRET || process.env.clientSecret || "", //- Client Secret of the bot
	port, //- Port of the API and Dashboard
	scopes: ["identify", "guilds", "applications.commands"], //- Discord OAuth2 Scopes
	inviteScopes: ["bot", "applications.commands"], // Invite link scopes
	serverDeafen: true, //- If you want bot to stay deafened
	defaultVolume: num("DEFAULT_VOLUME", 100), //- Sets the default volume of the bot, You can change this number anywhere from 1 to 100
	supportServer: "https://discord.gg/sbySMS7m3v", //- Support Server Link
	Issues: "https://github.com/SudhanPlayz/Discord-MusicBot/issues", //- Bug Report Link
	permissions: 277083450689, //- Bot Inviting Permissions
	disconnectTime: num("DISCONNECT_TIME", 30000), //- How long should the bot wait before disconnecting from the voice channel (in miliseconds). Set to 1 for instant disconnect.
	twentyFourSeven: bool("TWENTY_FOUR_SEVEN", false), //- When set to true, the bot will never disconnect from the voice channel
	autoQueue: bool("AUTO_QUEUE", false), //- When set to true, related songs will automatically be added to the queue
	autoPause: bool("AUTO_PAUSE", true), //- When set to true, music will automatically be paused if everyone leaves the voice channel
	autoLeave: bool("AUTO_LEAVE", false), //- When set to true, the bot will automatically leave when no one is in the voice channel (can be combined with 24/7 to always be in voice channel until everyone leaves; if 24/7 is on disconnectTime will add a disconnect delay after everyone leaves.)
	debug: bool("DEBUG", false), //- Debug mode
	cookieSecret: process.env.COOKIE_SECRET || "CodingWithSudhan is epic", //- Cookie Secret (set COOKIE_SECRET to a random string in production)
	website, //- without the / at the end
	// You need a lavalink server for this bot to work!!!!
	// This bot uses magmastream, which speaks the Lavalink **v4** protocol (Lavalink 4.x or NodeLink).
	// Lavalink server; public lavalink -> https://lavalink-list.darrennathanael.com/; create one yourself -> https://darrennathanael.com/post/how-to-lavalink
	// The second node is an optional backup: players move to it if the main one goes down.
	// Nodes with an empty host are ignored.
	nodes: [
		{
			identifier: "Main Node", //- Used for indentifier in stats commands.
			host: process.env.LAVALINK_HOST || "", //- The host name or IP of the lavalink server.
			port: num("LAVALINK_PORT", 443), // The port that lavalink is listening to. This must be a number!
			password: process.env.LAVALINK_PASSWORD || "", //- The password of the lavalink server.
			retryAmount: 10000, //- The amount of times to retry connecting to the node if connection got dropped (high = keep trying).
			retryDelay: 15 * 1000, //- Delay (ms) between reconnect attempts if connection is lost.
			secure: bool("LAVALINK_SECURE", true), //- Can be either true or false. Only use true if ssl is enabled!
			// YouTube login (OAuth refresh token) the bot hands to this server after connecting
			// (see util/youtubeToken.js). Only set this for your own server, never a public one.
			youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN || "",
		},
		{
			identifier: "Backup Node",
			host: process.env.LAVALINK2_HOST || "",
			port: num("LAVALINK2_PORT", 443),
			password: process.env.LAVALINK2_PASSWORD || "",
			retryAmount: 10000,
			retryDelay: 15 * 1000,
			secure: bool("LAVALINK2_SECURE", true),
		},
	],
	embedColor: "#2f3136", //- Color of the embeds, hex supported
	// What the bot shows in Discord's member list, e.g. "Listening to Music".
	// Set these in your host's environment variables to change it without editing code.
	presence: {
		// PresenceData object | https://discord.js.org/#/docs/main/stable/typedef/PresenceData
		status: oneOf("BOT_STATUS", ["online", "idle", "dnd", "invisible"], "online"), //- The colored dot (Note: invisible makes people think the bot is offline)
		activities: [
			{
				name: process.env.ACTIVITY_TEXT || "Music", //- Status Text
				type: oneOf("ACTIVITY_TYPE", ["PLAYING", "LISTENING", "WATCHING", "COMPETING"], "LISTENING"), //- "Playing ...", "Listening to ...", "Watching ...", "Competing in ..."
			},
		],
	},
	iconURL: "https://cdn.darrennathanael.com/icons/spinning_disk.gif", //- This icon will be in every embed's author field
};
