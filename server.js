const http = require('http');
const mineflayer = require('mineflayer');

// 1. Keep Render Web Service alive on process.env.PORT
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Web server listening on port ${PORT}`);
});

// 2. Mineflayer Bot Wrapper
class BotWrapper {
    constructor({
        username = 'Bot_Unknown4000',
        host = 'tokiyo.cogweb.store',
        port = 25565,
        version = false
    } = {}) {
        this.username = username;
        this.host = host;
        this.port = port;
        this.version = version;
        this.bot = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.antiAfkTimer = null;
        this.reconnectScheduled = false;
        this.stopping = false;
    }

    start() {
        if (this.stopping || this.bot || this.reconnectScheduled) return;

        console.log(`[${this.username}] Connecting to ${this.host}:${this.port}...`);
        try {
            const bot = mineflayer.createBot({
                host: this.host,
                port: this.port,
                username: this.username,
                auth: 'offline',
                version: this.version,
                checkTimeoutInterval: 60000,
                physicsEnabled: false
            });

            this.bot = bot;

            // Allow a position response after a server teleport/spawn, but drop idle movement packets.
            this.installMovementPacketFilter(bot);

            bot.once('spawn', () => {
                bot.physicsEnabled = false;
                this.reconnectAttempts = 0;
                console.log(`[${this.username}] Joined and spawned! Standing still safely.`);
                this.startAntiAfk();
            });

            bot.on('kicked', (reason) => {
                const text = typeof reason === 'object' ? JSON.stringify(reason) : reason;
                console.warn(`[${this.username}] Kicked: ${text}`);
            });

            bot.on('end', (reason) => {
                console.log(`[${this.username}] Disconnected: ${reason || 'connection ended'}`);
                this.cleanupBot();
                this.scheduleReconnect();
            });

            bot.on('error', (err) => {
                console.error(`[${this.username}] Error: ${err.message}`);
                this.cleanupBot();
                this.scheduleReconnect();
            });
        } catch (err) {
            this.cleanupBot();
            console.error(`[${this.username}] Could not start: ${err.message}`);
            this.scheduleReconnect();
        }
    }

    installMovementPacketFilter(bot) {
        let allowNextPositionPacket = false;
        const originalWrite = bot._client.write.bind(bot._client);

        // Whenever the server teleports/spawns the bot, allow 1 position confirmation packet
        bot._client.on('position', () => {
            allowNextPositionPacket = true;
        });

        bot._client.write = (name, params) => {
            if (name === 'position' || name === 'position_look' || name === 'look' || name === 'flying') {
                if (!allowNextPositionPacket) {
                    return;
                }
                allowNextPositionPacket = false;
                originalWrite(name, params);

                // Send tick_end if the protocol supports it (1.21.2+ / 26.x fix)
                try {
                    if (bot._client.serializer?.proto?.play?.toServer?.types?.packet_tick_end) {
                        originalWrite('tick_end', {});
                    }
                } catch (_) {}
                return;
            }
            return originalWrite(name, params);
        };
    }

    startAntiAfk() {
        if (this.antiAfkTimer) clearInterval(this.antiAfkTimer);
        this.antiAfkTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            try {
                // Arm swing does not move the bot.
                this.bot.swingArm();
            } catch (_) {}
        }, 30000);
    }

    cleanupBot() {
        if (this.antiAfkTimer) {
            clearInterval(this.antiAfkTimer);
            this.antiAfkTimer = null;
        }
        if (!this.bot) return;
        try {
            this.bot.removeAllListeners();
            this.bot.quit();
        } catch (_) {}
        this.bot = null;
    }

    scheduleReconnect() {
        if (this.stopping || this.reconnectScheduled) return;

        this.reconnectScheduled = true;
        this.reconnectAttempts += 1;
        const delay = Math.min(Math.max(this.reconnectAttempts * 15000, 15000), 60000);
        console.log(`[${this.username}] Reconnecting in ${delay / 1000}s...`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectScheduled = false;
            this.reconnectTimer = null;
            this.start();
        }, delay);
    }

    stop() {
        this.stopping = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnectScheduled = false;
        this.cleanupBot();
        console.log(`[${this.username}] Bot stopped.`);
    }
}

// Start up to six lightweight clients with a delay between connections.
// BOT_COUNT may reduce the number (1-6); six clients on 512 MB may still exceed the plan's memory limit.
const parsedBotCount = Number.parseInt(process.env.BOT_COUNT || '6', 10);
const BOT_COUNT = Number.isFinite(parsedBotCount) ? Math.min(6, Math.max(1, parsedBotCount)) : 6;
const USERNAME_PREFIX = (process.env.BOT_USERNAME_PREFIX || 'Bot_AFK_').slice(0, 14);
const bots = Array.from({ length: BOT_COUNT }, (_, index) =>
    new BotWrapper({ username: `${USERNAME_PREFIX}${index + 1}` })
);

bots.forEach((bot, index) => {
    setTimeout(() => bot.start(), index * 5000);
});

process.once('SIGINT', () => bots.forEach((bot) => bot.stop()));
process.once('SIGTERM', () => bots.forEach((bot) => bot.stop()));
