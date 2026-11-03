const mineflayer = require('mineflayer');

class BotWrapper {
    constructor({
        // Must be 16 characters or fewer (yours was 22)
        username = 'Bot_Unknown4000',
        host = 'jadesmp.mcsh.gg',
        port = 25565,
        version = false
    } = {}) {
        if (username.length > 16) {
            throw new Error(`Username "${username}" exceeds Minecraft's 16-character limit.`);
        }

        this.username = username;
        this.host = host;
        this.port = port;
        this.version = version;
        this.bot = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
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
                checkTimeoutInterval: 60000
            });

            this.bot = bot;

            bot.once('spawn', () => {
                this.reconnectAttempts = 0;
                console.log(`[${this.username}] Joined and spawned.`);
            });

            bot.on('kicked', (reason) => {
                const formattedReason = typeof reason === 'object' ? JSON.stringify(reason) : reason;
                console.warn(`[${this.username}] Kicked: ${formattedReason}`);
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

    cleanupBot() {
        if (!this.bot) return;
        try {
            this.bot.removeAllListeners();
            this.bot.quit();
        } catch (_) {
            // Ignore errors while tearing down a broken socket
        }
        this.bot = null;
    }

    scheduleReconnect() {
        if (this.stopping || this.reconnectScheduled) return;

        this.reconnectScheduled = true;
        this.reconnectAttempts += 1;
        const delay = Math.min(this.reconnectAttempts * 5000, 60000);
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
    }
}

const myBot = new BotWrapper();
myBot.start();

process.once('SIGINT', () => myBot.stop());
process.once('SIGTERM', () => myBot.stop());
