const { MessageEmbed } = require("discord.js");
const SlashCommand = require("../../lib/SlashCommand");

const command = new SlashCommand()
	.setName("filters")
	.setDescription("add or remove filters")
	.addStringOption((option) =>
		option
			.setName("preset")
			.setDescription("the preset to add")
			.setRequired(true)
			.addChoices(
				{ name: "Nightcore", value: "nightcore" },
				{ name: "BassBoost", value: "bassboost" },
				{ name: "Vaporwave", value: "vaporwave" },
				{ name: "Pop", value: "pop" },
				{ name: "Soft", value: "soft" },
				{ name: "Treblebass", value: "treblebass" },
				{ name: "Eight Dimension", value: "eightD" },
				{ name: "Karaoke", value: "karaoke" },
				{ name: "Vibrato", value: "vibrato" },
				{ name: "Tremolo", value: "tremolo" },
				{ name: "Reset", value: "off" },
			),
	)
	
	.setRun(async (client, interaction, options) => {
		const args = interaction.options.getString("preset");
		
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
						.setDescription("There's no music playing."),
				],
				ephemeral: true,
			});
		}
		
		// Filters are applied through magmastream's built-in player.filters API
		// (replaces the old erela.js-filters plugin, which only worked with Lavalink v3)
		// create a new embed
		let filtersEmbed = new MessageEmbed().setColor(client.config.embedColor);
		
		if (args == "nightcore") {
			filtersEmbed.setDescription("✅ | Nightcore filter is now active!");
			await player.filters.nightcore(true);
		} else if (args == "bassboost") {
			filtersEmbed.setDescription("✅ | BassBoost filter is now on!");
			await player.filters.bassBoost(2);
		} else if (args == "vaporwave") {
			filtersEmbed.setDescription("✅ | Vaporwave filter is now on!");
			await player.filters.vaporwave(true);
		} else if (args == "pop") {
			filtersEmbed.setDescription("✅ | Pop filter is now on!");
			await player.filters.pop(true);
		} else if (args == "soft") {
			filtersEmbed.setDescription("✅ | Soft filter is now on!");
			await player.filters.soft(true);
		} else if (args == "treblebass") {
			filtersEmbed.setDescription("✅ | Treblebass filter is now on!");
			await player.filters.trebleBass(true);
		} else if (args == "eightD") {
			filtersEmbed.setDescription("✅ | Eight Dimension filter is now on!");
			await player.filters.eightD(true);
		} else if (args == "karaoke") {
			filtersEmbed.setDescription("✅ | Karaoke filter is now on!");
			await player.filters.setKaraoke({ level: 1, monoLevel: 1, filterBand: 220, filterWidth: 100 });
		} else if (args == "vibrato") {
			filtersEmbed.setDescription("✅ | Vibrato filter is now on!");
			await player.filters.setVibrato({ frequency: 10, depth: 0.9 });
		} else if (args == "tremolo") {
			filtersEmbed.setDescription("✅ | Tremolo filter is now on!");
			await player.filters.tremolo(true);
		} else if (args == "off") {
			filtersEmbed.setDescription("✅ | EQ has been cleared!");
			await player.filters.clearFilters();
		} else {
			filtersEmbed.setDescription("❌ | Invalid filter!");
		}
		
		return interaction.reply({ embeds: [filtersEmbed] });
	});

module.exports = command;
