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

            // Fix for "multiplayer.disconnect.invalid_player_movement" 1.5s after spawn:
            // Only allow a single position response right after the server sends a teleport/position packet.
            // Block Mineflayer's 1-second idle position loop that gets the bot kicked.
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
                    // Drop Mineflayer's idle position packets so the server never kicks us
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
                // Arm swing does NOT send movement packets, so it won't trigger invalid_player_movement
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

const myBot = new BotWrapper();
myBot.start();

process.once('SIGINT', () => myBot.stop());
process.once('SIGTERM', () => myBot.stop());
