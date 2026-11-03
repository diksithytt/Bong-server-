const mineflayer = require('mineflayer');

class BotWrapper {
    constructor({
        username = 'The_Bot_by_Unknown4000',
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
        this.reconnectScheduled = false;
        this.stopping = false;
    }

    start() {
        if (this.stopping || this.bot || this.reconnectScheduled) return;

        console.log(`[${this.username}] Connecting to ${this.host}:${this.port}...`);
        try {
            this.bot = mineflayer.createBot({
                host: this.host,
                port: this.port,
                username: this.username,
                auth: 'offline',
                version: this.version,
                checkTimeoutInterval: 60000
            });

            this.bot.once('spawn', () => {
                this.reconnectAttempts = 0;
                console.log(`[${this.username}] Joined and spawned.`);
            });

            this.bot.on('kicked', (reason) => {
                console.warn(`[${this.username}] Kicked: ${reason}`);
            });

            this.bot.on('end', (reason) => {
                console.log(`[${this.username}] Disconnected: ${reason || 'connection ended'}`);
                this.scheduleReconnect();
            });

            this.bot.on('error', (err) => {
                console.error(`[${this.username}] Error: ${err.message}`);
                this.scheduleReconnect();
            });
        } catch (err) {
            this.bot = null;
            console.error(`[${this.username}] Could not start: ${err.message}`);
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (this.stopping || this.reconnectScheduled) return;

        this.reconnectScheduled = true;
        this.bot = null;
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
        if (this.bot) this.bot.quit();
        this.bot = null;
    }
}

const myBot = new BotWrapper();
myBot.start();

process.once('SIGINT', () => myBot.stop());
process.once('SIGTERM', () => myBot.stop());
