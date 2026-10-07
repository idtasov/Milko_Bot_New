/**
 * Plays Spotify links without the Spotify API.
 *
 * Spotify's developer API now requires the app owner to have Premium, so instead
 * of letting Lavalink's LavaSrc plugin load Spotify links, the bot reads the song
 * list from Spotify's public embed page (via spotify-url-info, no key needed) and
 * plays each song from YouTube on the bot's own Lavalink server.
 */
const spotify = require("spotify-url-info")(fetch);

// open.spotify.com links (incl. /intl-xx/), spotify: URIs and spotify.link short links
const SPOTIFY_REGEX =
	/^(?:https?:\/\/)?(?:(?:open|play)\.spotify\.com\/|spotify\.link\/)|^spotify:(?:track|album|playlist|artist):/i;

// Songs looked up before playback starts, and the batch size for the rest
const FIRST_BATCH = 3;
const BACKGROUND_BATCH = 4;

const isSpotifyUrl = (query) => typeof query === "string" && SPOTIFY_REGEX.test(query.trim());

/** spotify.link short links redirect to the real open.spotify.com URL */
async function expandShortLink(url) {
	if (!/spotify\.link\//i.test(url)) return url;
	const res = await fetch(url.startsWith("http") ? url : `https://${url}`, { redirect: "follow" });
	return res.url;
}

/**
 * Finds the YouTube version of one Spotify song. Searches YouTube Music first
 * (it returns the plain studio audio), then normal YouTube, and prefers the
 * result whose length is closest to the Spotify length.
 */
async function findOnYouTube(manager, song, requester) {
	const query = `${song.artist} - ${song.name}`;
	for (const source of ["ytmsearch", "ytsearch"]) {
		const res = await manager.search({ query, source }, requester).catch(() => null);
		const results = res?.tracks?.slice(0, 5) || [];
		if (!results.length) continue;

		const closest = song.duration
			? results.reduce((best, t) =>
					Math.abs(t.duration - song.duration) < Math.abs(best.duration - song.duration) ? t : best
			  )
			: results[0];
		// Show the Spotify title and artist instead of the YouTube video title
		closest.title = song.name;
		closest.author = song.artist;
		return { track: closest, node: res.node };
	}
	return null;
}

/** Looks up songs in order, a few at a time, keeping only the ones found. */
async function findBatch(manager, songs, requester) {
	const found = await Promise.all(songs.map((song) => findOnYouTube(manager, song, requester)));
	return found.filter(Boolean);
}

/**
 * Resolves a Spotify link into a search result shaped like magmastream's.
 * For playlists/albums the first few songs are returned right away and the
 * rest are added to `player`'s queue in the background, in order.
 * With `playFirst` (/playnow) the rest go right after the first songs instead of
 * at the end of the queue, so the playlist stays together at the front.
 */
async function resolveSpotify(player, url, requester, { playFirst = false } = {}) {
	// The library fetches and parses the embed page; the song fields are read here
	// directly so a missing optional field (e.g. cover art) can't break playback.
	let data;
	try {
		data = await spotify.getData(await expandShortLink(url.trim()));
	} catch (err) {
		console.log(`[Spotify] Could not read ${url}: ${err.message.split("\n")[0]}`);
		return { loadType: "error", tracks: [] };
	}

	// Playlists/albums list their songs in trackList (max 100); a track is its own entry
	const songs = (data.trackList || [data])
		.map((s) => ({
			name: s.title || s.name,
			artist: (s.artists || []).map((a) => a.name).join(", ") || s.subtitle || "",
			duration: s.duration || 0,
		}))
		.filter((s) => s.name);
	if (!songs.length) return { loadType: "empty", tracks: [] };

	const manager = player.manager;

	// Single song
	if (data.type === "track") {
		const found = await findOnYouTube(manager, songs[0], requester);
		if (!found) return { loadType: "empty", tracks: [] };
		const res = { loadType: "track", tracks: [found.track] };
		Object.defineProperty(res, "node", { value: found.node, enumerable: false });
		return res;
	}

	// Playlist / album / artist: find songs until at least one plays
	let index = 0;
	let first = [];
	while (!first.length && index < songs.length) {
		const batch = songs.slice(index, index + FIRST_BATCH);
		index += batch.length;
		first = await findBatch(manager, batch, requester);
	}
	if (!first.length) return { loadType: "empty", tracks: [] };

	const tracks = first.map((f) => f.track);
	const res = {
		loadType: "playlist",
		tracks,
		playlist: {
			name: data.name || "Spotify playlist",
			duration: songs.reduce((sum, s) => sum + (s.duration || 0), 0),
			totalTracks: songs.length,
			tracks,
		},
	};
	Object.defineProperty(res, "node", { value: first[0].node, enumerable: false });

	// Add the remaining songs in the background, after the caller has queued `tracks`
	const remaining = songs.slice(index);
	if (remaining.length) {
		setTimeout(async () => {
			let missing = 0;
			let lastAdded = tracks[tracks.length - 1];
			for (let i = 0; i < remaining.length; i += BACKGROUND_BATCH) {
				// Stop if the player was stopped or replaced meanwhile
				if (manager.players.get(player.guildId) !== player) return;
				const batch = remaining.slice(i, i + BACKGROUND_BATCH);
				const found = await findBatch(manager, batch, requester);
				missing += batch.length - found.length;
				if (manager.players.get(player.guildId) !== player) return;
				if (!found.length) continue;
				const batchTracks = found.map((f) => f.track);
				const last = batchTracks[batchTracks.length - 1]; // queue.add may shift the array
				if (playFirst) {
					// Right after this playlist's last queued song; if that one is playing
					// or already played, indexOf is -1, so this becomes the front (0)
					player.queue.add(batchTracks, player.queue.indexOf(lastAdded) + 1);
				} else {
					player.queue.add(batchTracks);
				}
				lastAdded = last;
			}
			if (missing) {
				console.log(`[Spotify] ${missing} of ${songs.length} songs could not be found on YouTube`);
			}
		}, 0);
	}

	return res;
}

module.exports = { isSpotifyUrl, resolveSpotify };
