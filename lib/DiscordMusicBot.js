const {
  Client,
  Intents,
  MessageEmbed,
  Collection,
  MessageActionRow,
  MessageButton,
} = require("discord.js");
const escapeMarkdown = require('discord.js').Util.escapeMarkdown;
const fs = require("fs");
const path = require("path");
const prettyMilliseconds = require("pretty-ms");
const jsoning = require("jsoning"); // Documentation: https://jsoning.js.org/
// magmastream is a maintained fork of erela.js that speaks the Lavalink v4 protocol
const { Manager } = require("magmastream");
require("./daveVoicePatch"); // sends the voice channel ID Discord's encrypted voice (DAVE) needs
require("./restTimeoutPatch"); // time limit + error logging for requests to Lavalink servers
const ConfigFetcher = require("../util/getConfig");
const Logger = require("./Logger");
const Server = require("../api");
const getLavalink = require("../util/getLavalink");
const getChannel = require("../util/getChannel");
const colors = require("colors");
const { default: EpicPlayer } = require("./EpicPlayer");
class DiscordMusicBot extends Client {
  /**
   * Create the music client
   * @param {import("discord.js").ClientOptions} props - Client options
   */
  constructor(
    props = {
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILD_MESSAGES,
      ],
    }
  ) {
    super(props);

    ConfigFetcher().then((conf) => {
      this.config = conf;
      this.build();
    });

    //Load Events and stuff
    /**@type {Collection<string, import("./SlashCommand")} */
    this.slashCommands = new Collection();
    this.contextCommands = new Collection();

    this.logger = new Logger(path.join(__dirname, "..", "logs.log"));

    this.LoadCommands();
    this.LoadEvents();

    this.database = new jsoning("db.json");

    this.deletedMessages = new WeakSet();
    this.getLavalink = getLavalink;
    this.getChannel = getChannel;
    this.ms = prettyMilliseconds;
    this.commandsRan = 0;
    this.songsPlayed = 0;
  }

  /**
   * Send an info message
   * @param {string} text
   */
  log(text) {
    this.logger.log(text);
  }

  /**
   * Send an warning message
   * @param {string} text
   */
  warn(text) {
    this.logger.warn(text);
  }

  /**
   * Send an error message
   * @param {string} text
   */
  error(text) {
    this.logger.error(text);
  }

  /**
   * Build em
   */
  build() {
    this.warn("Started the bot...");

    // Fail fast with a readable message when required settings are missing
    // (common on first deploy when an env var was forgotten in the host dashboard).
    if (!this.config.token || !this.config.clientId) {
      this.error("TOKEN and CLIENT_ID must be set (see .env.example / HOSTING.md).");
      process.exit(1);
    }
    if (!this.config.nodes?.some((node) => node.host)) {
      this.warn("LAVALINK_HOST is not set, music playback will not work until it is.");
    }

    this.login(this.config.token);
    this.server = this.config.website?.length ? new Server(this) : null; // constructing also starts it; Do not start server when no website configured
    if (this.config.debug === true) {
      this.warn("Debug mode is enabled!");
      this.warn("Only enable this if you know what you are doing!");
      process.on("unhandledRejection", (error) => console.log(error));
      process.on("uncaughtException", (error) => console.log(error));
    } else {
      // Keep the bot alive on errors, but still log a one-line summary so
      // problems are visible in the hosting provider's log viewer.
      process.on("unhandledRejection", (error) => {
        this.error(`Unhandled rejection: ${error?.message || error}`);
      });
      process.on("uncaughtException", (error) => {
        this.error(`Uncaught exception: ${error?.message || error}`);
      });
    }

    let client = this;

    /**
     * will hold at most 100 tracks, for the sake of autoqueue
     */
    let playedTracks = [];

    // Spotify/Apple Music/Deezer links are resolved by the Lavalink server itself
    // (via its LavaSrc plugin), so no client-side source plugins are needed anymore.
    this.manager = new Manager({
      autoPlay: true,
      // Skip unconfigured nodes (e.g. an empty backup slot) so they don't throw on startup
      nodes: this.config.nodes.filter((node) => node.host),
      retryDelay: this.config.retryDelay,
      retryAmount: this.config.retryAmount,
      clientName: `DiscordMusic/v${require("../package.json").version} (Bot: ${
        this.config.clientId
      })`,
      send: (id, payload) => {
        let guild = client.guilds.cache.get(id);
        if (guild) {
          guild.shard.send(payload);
        }
      },
    })
      .on("nodeConnect", async (node) => {
        // Log the server's Lavalink version: Discord's encrypted voice (DAVE)
        // needs a recent server, so this shows at a glance whether a node can play audio.
        const info = await node.rest.get("/v4/info").catch(() => null);
        const version = info?.version?.semver;
        this.log(
          `Node: ${node.options.identifier} | Lavalink node is connected.` +
            ` Server version: ${version || "unknown (server did not answer the version check)"}`
        );
      })
      .on("nodeReconnect", (node) =>
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is reconnecting.`
        )
      )
      .on("nodeDestroy", (node) =>
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is destroyed.`
        )
      )
      .on("nodeDisconnect", (node, reason) =>
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node is disconnected.` +
            (reason?.code ? ` Code: ${reason.code} ${reason.reason || ""}` : "")
        )
      )
      // Discord closed the voice connection; the close code explains why
      // (e.g. 4017 = the server doesn't support Discord's encrypted voice, DAVE)
      .on("socketClosed", (player, payload) =>
        this.warn(
          `Player: ${player.guildId} | Voice connection closed by Discord. Code: ${payload?.code} ${payload?.reason || ""} (node: ${player.node?.options.identifier})`
        )
      )
      .on("nodeError", (node, err) => {
        this.warn(
          `Node: ${node.options.identifier} | Lavalink node has an error: ${err.message}.`
        );
      })
      // on track error warn and create embed
      .on("trackError", (player, track, payload) => {
        this.warn(
          `Player: ${player.guildId} | Track had an error: ${payload?.exception?.message}.`
        );
        //console.log(err);
        let song = player.queue.current;
        var title = escapeMarkdown(song.title)
        var title = title.replace(/\]/g,"")
        var title = title.replace(/\[/g,"")
        
        let errorEmbed = new MessageEmbed()
          .setColor("RED")
          .setTitle("Playback error!")
          .setDescription(`Failed to load track: \`${title}\``)
          .setFooter({
            text: "Oops! something went wrong but it's not your fault!",
          });
        client.channels.cache
          .get(player.textChannelId)
          .send({ embeds: [errorEmbed] });
      })

      .on("trackStuck", (player, track, payload) => {
        this.warn(
          `Player: ${player.guildId} | Track got stuck after ${payload?.thresholdMs}ms.`
        );
        //console.log(err);
        let song = player.queue.current;
        var title = escapeMarkdown(song.title)
        var title = title.replace(/\]/g,"")
        var title = title.replace(/\[/g,"")
        
        let errorEmbed = new MessageEmbed()
          .setColor("RED")
          .setTitle("Track error!")
          .setDescription(`Failed to load track: \`${title}\``)
          .setFooter({
            text: "Oops! something went wrong but it's not your fault!",
          });
        client.channels.cache
          .get(player.textChannelId)
          .send({ embeds: [errorEmbed] });
      })
      .on("playerMove", (player, oldChannel, newChannel) => {
        const guild = client.guilds.cache.get(player.guildId);
        if (!guild) {
          return;
        }
        const channel = guild.channels.cache.get(player.textChannelId);
        if (oldChannel === newChannel) {
          return;
        }
        if (newChannel === null || !newChannel) {
          if (!player) {
            return;
          }
          if (channel) {
            channel.send({
              embeds: [
                new MessageEmbed()
                  .setColor(client.config.embedColor)
                  .setDescription(`Disconnected from <#${oldChannel}>`),
              ],
            });
          }
          return player.destroy();
        } else {
          player.setVoiceChannelId(newChannel);
          setTimeout(() => player.pause(false), 1000);
          return undefined;
        }
      })
      .on("playerCreate", (player) => {
        player.set("twentyFourSeven", client.config.twentyFourSeven);
        player.set("autoQueue", client.config.autoQueue);
        player.set("autoPause", client.config.autoPause);
        player.set("autoLeave", client.config.autoLeave);
        this.warn(
          `Player: ${
            player.guildId
          } | A wild player has been created in ${
            client.guilds.cache.get(player.guildId)
              ? client.guilds.cache.get(player.guildId).name
              : "a guild"
          }`
        );
      })
      .on("playerDestroy", (player) => {
        this.warn(
          `Player: ${player.guildId} | A wild player has been destroyed in ${client.guilds.cache.get(player.guildId)
              ? client.guilds.cache.get(player.guildId).name
              : "a guild"
          }`
        )
        player.setNowplayingMessage(client, null);
      })
      // on TRACK_START send message
      .on(
        "trackStart",
        /** @param {EpicPlayer} player */ async (player, track) => {
          this.songsPlayed++;
          playedTracks.push(track.identifier);
          if (playedTracks.length >= 100) {
            playedTracks.shift();
          }

          this.warn(
            `Player: ${
              player.guildId
            } | Track has been started playing [${colors.blue(track.title)}] on ${player.node?.options.identifier}`
          );
            var title = escapeMarkdown(track.title)
            var title = title.replace(/\]/g,"")
            var title = title.replace(/\[/g,"")
          let trackStartedEmbed = this.Embed()
            .setAuthor({ name: "Now playing", iconURL: this.config.iconURL })
            .setDescription(
              `[${title}](${track.uri})` || "No Descriptions"
            )
            .addFields(
              {
                name: "Requested by",
                value: `${track.requester || `<@${client.user.id}>`}`,
                inline: true,
              },
              {
                name: "Duration",
                value: track.isStream
                  ? `\`LIVE\``
                  : `\`${prettyMilliseconds(track.duration, {
                      colonNotation: true,
                    })}\``,
                inline: true,
              }
            );
          try {
            trackStartedEmbed.setThumbnail(
              track.displayThumbnail("maxresdefault")
            );
          } catch (err) {
            trackStartedEmbed.setThumbnail(track.thumbnail);
          }
          let nowPlaying = await client.channels.cache
            .get(player.textChannelId)
            .send({
              embeds: [trackStartedEmbed],
              components: [
                client.createController(player.guildId, player),
              ],
            })
            .catch(this.warn);
          player.setNowplayingMessage(client, nowPlaying);
       }
      )
    
      .on(
        "playerDisconnect",
          /** @param {EpicPlayer} */ async (player) => {
            if (player.twentyFourSeven) {
              player.queue.clear();
              player.stop();
              player.set("autoQueue", false);
            } else {
              player.destroy();
            }
          }
      )
    
      .on(
        "queueEnd",
        /** @param {EpicPlayer} */ async (player, track) => {
          const autoQueue = player.get("autoQueue");

          if (autoQueue) {
            const requester = player.get("requester");
            const identifier = track.identifier;
            const search = `https://www.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
            const res = await player.search(search, requester);
            let nextTrackIndex;

            res.tracks.some((track, index) => {
              nextTrackIndex = index;
              return !playedTracks.includes(track.identifier);
            });

            // Lavalink v4 reports failed/empty loads via loadType instead of an exception field
            if (res.loadType === "error" || res.loadType === "empty" || !res.tracks.length) {
              client.channels.cache.get(player.textChannelId).send({
                embeds: [
                  new MessageEmbed()
                    .setColor("RED")
                    .setAuthor({
                      name: "Autoqueue",
                      iconURL: client.config.iconURL,
                    })
                    .setDescription("Could not load a related track."),
                ],
              });
              return player.destroy();
            }

            // magmastream records finished tracks in queue.previous by itself
            player.play(res.tracks[nextTrackIndex]);
          } else {
            const twentyFourSeven = player.get("twentyFourSeven");

            let queueEmbed = new MessageEmbed()
              .setColor(client.config.embedColor)
              .setAuthor({
                name: "The queue has ended",
                iconURL: client.config.iconURL,
              })
              .setFooter({ text: "Queue ended" })
              .setTimestamp();
            let EndQueue = await client.channels.cache
              .get(player.textChannelId)
              .send({ embeds: [queueEmbed] });
            setTimeout(() => EndQueue.delete(true), 5000);
            try {
              if (!player.playing && !twentyFourSeven) {
                setTimeout(async () => {
                  if (!player.playing && player.state !== "DISCONNECTED") {
                    let disconnectedEmbed = new MessageEmbed()
                      .setColor(client.config.embedColor)
                      .setAuthor({
                        name: "Disconnected!",
                        iconURL: client.config.iconURL,
                      })
                      .setDescription(
                        `The player has been disconnected due to inactivity.`
                      );
                    let Disconnected = await client.channels.cache
                      .get(player.textChannelId)
                      .send({ embeds: [disconnectedEmbed] });
                    setTimeout(() => Disconnected.delete(true), 6000);
                    player.destroy();
                  } else if (player.playing) {
                    client.warn(
                      `Player: ${player.guildId} | Still playing`
                    );
                  }
                }, client.config.disconnectTime);
              } else if (!player.playing && twentyFourSeven) {
                client.warn(
                  `Player: ${
                    player.guildId
                  } | Queue has ended [${colors.blue("24/7 ENABLED")}]`
                );
              } else {
                client.warn(
                  `Something unexpected happened with player ${player.guildId}`
                );
              }
              player.setNowplayingMessage(client, null);
            } catch (err) {
              client.error(err);
            }
          }
        }
      );

    // magmastream normally sends searches and new players to whichever server has the
    // fewest players, which can pick a broken backup over a healthy main server.
    // Instead, use servers in config order: the main one while it's connected,
    // the backup only when the main one is down.
    const nodeOrder = this.config.nodes.map((node) => node.identifier);
    const connectedNodesInOrder = () =>
      nodeOrder
        .map((id) => this.manager.nodes.get(id))
        .filter((node) => node && node.connected);
    const useNode = (getNode) =>
      Object.defineProperty(this.manager, "useableNode", {
        get: getNode,
        configurable: true,
      });
    const preferMainNode = () => connectedNodesInOrder()[0];
    useNode(preferMainNode);

    // If a search fails on one server (error, or no answer), retry it on the next
    // one before giving up, so one misbehaving server doesn't break /play.
    const search = this.manager.search.bind(this.manager);
    this.manager.search = async (query, requester) => {
      let lastError;
      for (const node of connectedNodesInOrder()) {
        // magmastream reads useableNode synchronously when a search starts, so point
        // it at this server, start the search, and restore it before waiting.
        useNode(() => node);
        const pending = search(query, requester);
        useNode(preferMainNode);
        try {
          const res = await pending;
          if (res.loadType !== "error") return res;
          lastError = new Error(`Search failed on ${node.options.identifier}`);
        } catch (err) {
          lastError = err;
        }
        this.warn(
          `Node: ${node.options.identifier} | Search failed, trying the next server if there is one.`
        );
      }
      throw lastError || new Error("No Lavalink server is connected.");
    };
  }

  /**
   * Checks if a message has been deleted during the run time of the Bot
   * @param {Message} message
   * @returns
   */
  isMessageDeleted(message) {
    return this.deletedMessages.has(message);
  }

  /**
   * Marks (adds) a message on the client's `deletedMessages` WeakSet so it's
   * state can be seen through the code
   * @param {Message} message
   */
  markMessageAsDeleted(message) {
    this.deletedMessages.add(message);
  }

  /**
   *
   * @param {string} text
   * @returns {MessageEmbed}
   */
  Embed(text) {
    let embed = new MessageEmbed().setColor(this.config.embedColor);

    if (text) {
      embed.setDescription(text);
    }

    return embed;
  }

  /**
   *
   * @param {string} text
   * @returns {MessageEmbed}
   */
  ErrorEmbed(text) {
    let embed = new MessageEmbed()
      .setColor("RED")
      .setDescription("❌ | " + text);

    return embed;
  }

  LoadEvents() {
    let EventsDir = path.join(__dirname, "..", "events");
    fs.readdir(EventsDir, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          const event = require(EventsDir + "/" + file);
          this.on(file.split(".")[0], event.bind(null, this));
          this.warn("Event Loaded: " + file.split(".")[0]);
        });
      }
    });
  }

  LoadCommands() {
    let SlashCommandsDirectory = path.join(
      __dirname,
      "..",
      "commands",
      "slash"
    );
    fs.readdir(SlashCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(SlashCommandsDirectory + "/" + file);

          if (!cmd || !cmd.run) {
            return this.warn(
              "Unable to load Command: " +
                file.split(".")[0] +
                ", File doesn't have an valid command with run function"
            );
          }
          this.slashCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("Slash Command Loaded: " + file.split(".")[0]);
        });
      }
    });

    let ContextCommandsDirectory = path.join(
      __dirname,
      "..",
      "commands",
      "context"
    );
    fs.readdir(ContextCommandsDirectory, (err, files) => {
      if (err) {
        throw err;
      } else {
        files.forEach((file) => {
          let cmd = require(ContextCommandsDirectory + "/" + file);
          if (!cmd.command || !cmd.run) {
            return this.warn(
              "Unable to load Command: " +
                file.split(".")[0] +
                ", File doesn't have either command/run"
            );
          }
          this.contextCommands.set(file.split(".")[0].toLowerCase(), cmd);
          this.log("ContextMenu Loaded: " + file.split(".")[0]);
        });
      }
    });
  }

  /**
   *
   * @param {import("discord.js").TextChannel} textChannel
   * @param {import("discord.js").VoiceChannel} voiceChannel
   */
  createPlayer(textChannel, voiceChannel) {
    return this.manager.create({
      guildId: textChannel.guild.id,
      voiceChannelId: voiceChannel.id,
      textChannelId: textChannel.id,
      selfDeafen: this.config.serverDeafen,
      volume: this.config.defaultVolume,
    });
  }

  createController(guild, player) {
    return new MessageActionRow().addComponents(
      new MessageButton()
        .setStyle("DANGER")
        .setCustomId(`controller:${guild}:Stop`)
        .setEmoji("⏹️"),

      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Replay`)
        .setEmoji("⏮️"),

      new MessageButton()
        .setStyle(player.playing ? "PRIMARY" : "DANGER")
        .setCustomId(`controller:${guild}:PlayAndPause`)
        .setEmoji(player.playing ? "⏸️" : "▶️"),

      new MessageButton()
        .setStyle("PRIMARY")
        .setCustomId(`controller:${guild}:Next`)
        .setEmoji("⏭️"),

      new MessageButton()
        .setStyle(
          player.trackRepeat
            ? "SUCCESS"
            : player.queueRepeat
            ? "SUCCESS"
            : "DANGER"
        )
        .setCustomId(`controller:${guild}:Loop`)
        .setEmoji(player.trackRepeat ? "🔂" : player.queueRepeat ? "🔁" : "🔁")
    );
  }
}

module.exports = DiscordMusicBot;
