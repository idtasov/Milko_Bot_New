const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");
const escapeMarkdown = require("discord.js").Util.escapeMarkdown;

// Like /play, but puts the song (or playlist) at the FRONT of the queue instead of
// the end, so it plays right after the current song. With `skip: True` the current
// song is skipped and the new one starts immediately.
const command = new SlashCommand()
  .setName("playnow")
  .setDescription("Plays a song next, ahead of the rest of the queue (or right away with skip)")
  .addStringOption((option) =>
    option
      .setName("query")
      .setDescription("What am I looking for?")
      .setAutocomplete(true)
      .setRequired(true)
  )
  .addBooleanOption((option) =>
    option
      .setName("skip")
      .setDescription("Skip the current song and start this one right away (default: play it next)")
  )
  .setRun(async (client, interaction, options) => {
    let channel = await client.getChannel(client, interaction);
    if (!channel) {
      return;
    }

    let node = await client.getLavalink(client);
    if (!node) {
      return interaction.reply({
        embeds: [client.ErrorEmbed("Lavalink node is not connected")],
      });
    }

    let player = client.createPlayer(interaction.channel, channel);

    if (player.state !== "CONNECTED") {
      player.connect();
    }

    const ret = await interaction.reply({
      embeds: [
        new MessageEmbed()
          .setColor(client.config.embedColor)
          .setDescription(":mag_right: **Searching...**"),
      ],
      fetchReply: true,
    });

    const query = options.getString("query", true);
    const skipCurrent = options.getBoolean("skip") || false;
    const res = await player
      .search(query, interaction.user, { playFirst: true })
      .catch((err) => {
        client.error(err);
        return { loadType: "error" };
      });

    if (!["track", "search", "playlist"].includes(res.loadType) || !res.tracks?.length) {
      if (!player.queue.current) {
        player.destroy();
      }
      await interaction
        .editReply({
          embeds: [
            new MessageEmbed()
              .setColor("RED")
              .setDescription(
                res.loadType === "error"
                  ? "There was an error while searching"
                  : "No results were found"
              ),
          ],
        })
        .catch(client.warn);
      return;
    }

    // A playlist goes to the front as a whole, in order; a search only uses the top result
    const isPlaylist = res.loadType === "playlist";
    const tracks = isPlaylist ? [...res.tracks] : [res.tracks[0]];
    const first = tracks[0];
    const wasIdle = !player.queue.current;

    // Position 0 = the very next song. (When nothing is playing, magmastream makes the
    // first track the current song instead.) A copy is passed because queue.add
    // removes the first track from the array it's given.
    player.queue.add([...tracks], 0);

    let startedNow = false;
    if (wasIdle) {
      player.play();
      startedNow = true;
    } else if (skipCurrent) {
      // Lavalink stays paused across songs, so unpause first; stopping the current
      // song then makes magmastream play the next one, which is ours
      if (player.paused) await player.pause(false);
      player.stop();
      startedNow = true;
    }

    const embed = new MessageEmbed().setColor(client.config.embedColor);
    if (isPlaylist) {
      embed
        .setAuthor({
          name: startedNow ? "Playing playlist now" : "Playlist will play next",
          iconURL: client.config.iconURL,
        })
        .setThumbnail(first.thumbnail)
        .setDescription(`[${res.playlist.name}](${query})`)
        .addFields({
          name: "Enqueued",
          // Spotify playlists report their full size; the rest are added in the background
          value: `\`${res.playlist.totalTracks || res.tracks.length}\` songs`,
          inline: true,
        });
    } else {
      const title = escapeMarkdown(first.title).replace(/[\[\]]/g, "");
      embed
        .setAuthor({
          name: startedNow ? "Playing now" : "Playing next",
          iconURL: client.config.iconURL,
        })
        .setDescription(`[${title}](${first.uri})`)
        .setURL(first.uri)
        .addFields({
          name: "Duration",
          value: first.isStream
            ? `\`LIVE 🔴 \``
            : `\`${client.ms(first.duration, {
                colonNotation: true,
                secondsDecimalDigits: 0,
              })}\``,
          inline: true,
        });
      try {
        embed.setThumbnail(first.displayThumbnail("maxresdefault"));
      } catch (err) {
        embed.setThumbnail(first.thumbnail);
      }
    }
    embed.addFields({
      name: "Added by",
      value: `<@${interaction.user.id}>`,
      inline: true,
    });

    await interaction.editReply({ embeds: [embed] }).catch(client.warn);

    if (ret) setTimeout(() => ret.delete().catch(client.warn), 20000);
    return ret;
  });

module.exports = command;
