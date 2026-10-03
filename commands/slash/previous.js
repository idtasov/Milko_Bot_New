const SlashCommand = require("../../lib/SlashCommand");
const { MessageEmbed } = require("discord.js");

const command = new SlashCommand()
.setName("previous")
.setDescription("Go back to the previous song.")
.setRun(async (client, interaction) => {
	let channel = await client.getChannel(client, interaction);
	if (!channel) {
		return;
	}

	let player;
	if (client.manager) {
		player = client.manager.players.get(interaction.guild.id);
	} else {
		return interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor("RED")
					.setDescription("Lavalink node is not connected"),
			],
		});
	}

	if (!player) {
		return interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor("RED")
					.setDescription("There are no previous songs for this session."),
			],
			ephemeral: true,
		});
	}

	// magmastream keeps a history of finished tracks; the newest one is last
	const previousSong = player.queue.previous[player.queue.previous.length - 1];
	const currentSong = player.queue.current;

	if (!previousSong) {
		return interaction.reply({
			embeds: [
				new MessageEmbed()
					.setColor("RED")
					.setDescription("There is no previous song in the queue."),
			],
		})}

	// Put the current song back at the front of the queue so it plays next,
	// then let magmastream pop and play the previous track
	if (currentSong) {
		player.queue.add(currentSong, 0);
	}
	await player.previous();
	interaction.reply({
		embeds: [
			new MessageEmbed()
				.setColor(client.config.embedColor)
				.setDescription(
					`⏮ | Previous song: **${ previousSong.title }**`,
				),
		],
	});
});

module.exports = command;
