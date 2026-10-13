// "[13.10.2026 - 09:46 UTC]". getMonth() counts from 0 (January = 0), hence the + 1.
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d) =>
	`[${ pad(d.getUTCDate()) }.${ pad(d.getUTCMonth() + 1) }.${ d.getUTCFullYear() } - ${ pad(d.getUTCHours()) }:${ pad(d.getUTCMinutes()) } UTC]`;

const winston = require("winston");
const colors = require("colors");

class Logger {
	constructor(file) {
		this.logger = winston.createLogger({
			transports: [new winston.transports.File({ filename: file })],
		});
	}
	
	log(Text) {
		let d = new Date();
		this.logger.log({
			level: "info",
			message: "info: " + Text,
		});
		console.log(
			colors.gray(
				stamp(d),
			) + colors.green(" | " + Text),
		);
	}
	
	warn(Text) {
		let d = new Date();
		this.logger.log({
			level: "warn",
			message: "warn: " + Text,
		});
		console.log(
			colors.gray(
				stamp(d),
			) + colors.yellow(" | " + Text),
		);
	}
	
	error(Text) {
		let d = new Date();
		this.logger.log({
			level: "error",
			message: "error: " + Text,
		});
		console.log(
			colors.gray(
				stamp(d),
			) + colors.red(" | " + Text),
		);
	}
}

module.exports = Logger;
