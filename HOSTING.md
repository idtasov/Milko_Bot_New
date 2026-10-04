# Free hosting guide

This bot has two parts:

1. **The bot itself** (this repo, Node.js). It connects to Discord and handles commands. It's light enough for a free host.
2. **A Lavalink server** (Java). It does the actual audio streaming into voice channels. It's too heavy for free web hosts, so use a **public Lavalink node** instead of running your own.

The steps below use **Render** (free web service) plus **UptimeRobot** (free pinger that keeps the bot awake).

---

## 1. Create the Discord application

1. Go to <https://discord.com/developers/applications> and click **New Application**.
2. **General Information**: copy the **Application ID**. This is `CLIENT_ID`.
3. **OAuth2**: click **Reset Secret** and copy it. This is `CLIENT_SECRET`.
4. **Bot**: click **Reset Token** and copy it. This is `TOKEN`. Never share or commit it.
5. Still on **Bot**, turn on **Message Content Intent**.
6. Invite the bot to your server with this link (put your Application ID in it):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=277083450689&scope=bot%20applications.commands`

## 2. Pick Lavalink servers

The bot works with **Lavalink v4** servers and **NodeLink** servers (both use the v4 protocol). Old v3-only servers won't work.

- Browse <https://lavalink-list.darrennathanael.com/> and pick a v4 server, preferably one with SSL (port 443).
- Its **host**, **port**, **password** and **secure** values become
  `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD` and `LAVALINK_SECURE`.
- Optionally, pick a second server from a **different host** as a backup and put it in `LAVALINK2_HOST`, `LAVALINK2_PORT`, `LAVALINK2_PASSWORD` and `LAVALINK2_SECURE`. If the main server goes down, the bot moves playback to the backup automatically.

**Use servers running the newest Lavalink (4.2 or later).** Since March 2026, Discord requires encrypted voice (called DAVE). Older servers can connect and "start" a song, but no sound reaches the voice channel. If that happens, the Render log shows `Voice connection closed by Discord. Code: 4017`.

**Spotify links** are handled by the bot itself: it reads the song list from Spotify's public embed page (up to 100 songs, no Spotify account or Premium needed) and plays each song from YouTube. Apple Music and Deezer links only work if the server has the LavaSrc plugin. YouTube and SoundCloud work on almost all servers.

Public servers come and go. If music stops working one day, swap in another server by updating these variables in Render.

## 3. Deploy on Render

1. Push this repo to your GitHub account.
2. Sign up at <https://render.com> and connect GitHub.
3. Click **New → Blueprint** and choose this repo. Render reads `render.yaml` and creates a free web service.
4. Fill in the values it asks for (`TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`, `ADMIN_ID`, and the `LAVALINK_*` values). Leave the `LAVALINK2_*` fields empty if you don't want a backup.
5. Click **Apply**. Within a few minutes, the logs should show `Successfully Logged in as ...` and `Lavalink node is connected.`

On every start, the bot registers its slash commands with Discord. Global commands can take a few minutes to show up the first time.

## 4. Keep it awake (important)

Free Render services **go to sleep after 15 minutes without web traffic**. When that happens, the bot goes offline in Discord.

1. Copy your service URL from Render (for example `https://discord-musicbot-xxxx.onrender.com`).
2. Create a free account at <https://uptimerobot.com>.
3. Add an **HTTP(s) monitor** for `https://YOUR-URL.onrender.com/health` with a **5-minute** interval.

Render's free plan includes 750 hours per month, which is enough to run one service all month.

## 5. (Optional) Web dashboard login

In the Discord Developer Portal, go to **OAuth2 → Redirects** and add `https://YOUR-URL.onrender.com/api/callback`.

---

## Limitations of free hosting

- **Settings reset on redeploy.** Render's free disk is temporary, so per-server settings stored in `db.json` are lost when the service restarts.
- **Brief downtime** happens when Render restarts or redeploys the service.
- **Public Lavalink servers** are shared and can be slow or go offline. A backup server helps.

## Other hosts

The included `Dockerfile` works on any host that runs containers (such as Koyeb). Set the same environment variables, expose port `4200` (or set `PORT`), and use `/health` as the health check path.

## Running locally

```bash
cp .env.example .env   # then fill it in
npm install
npm run deploy-and-start
```
