const http = require('http');
const mineflayer = require('mineflayer');

// 1. Keep Render Web Service alive by binding to process.env.PORT
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!\n');
}).listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Web server listening on port ${PORT} for Render health checks.`);
});

// 2. Mineflayer Bot Wrapper
class BotWrapper {
    constructor({
        username = 'Bot_Unknown4000',
        host = 'jadesmp.mcsh.gg',
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
                physicsEnabled: false // Fixes "invalid_player_movement" kick!
            });

            this.bot = bot;

            bot.once('spawn', () => {
                // Keep physics disabled so chunk loading / anti-cheat doesn't kick the bot
                bot.physicsEnabled = false;
                this.reconnectAttempts = 0;
                console.log(`[${this.username}] Joined and spawned successfully!`);
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

    startAntiAfk() {
        if (this.antiAfkTimer) clearInterval(this.antiAfkTimer);
        this.antiAfkTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            try {
                // Swing arm & toggle sneak instead of moving/jumping to avoid movement kicks
                this.bot.swingArm();
                this.bot.setControlState('sneak', true);
                setTimeout(() => {
                    if (this.bot) this.bot.setControlState('sneak', false);
                }, 500);
            } catch (e) {
                // Ignore packet errors
            }
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
        } catch (e) {
            // Ignore cleanup errors
        }
        this.bot = null;
    }

    scheduleReconnect() {
        if (this.stopping || this.reconnectScheduled) return;

        this.reconnectScheduled = true;
        this.reconnectAttempts += 1;

        // Wait at least 15 seconds between retries so the server doesn't throttle us
        const delay = Math.min(Math.max(this.reconnectAttempts * 10000, 15000), 60000);
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
