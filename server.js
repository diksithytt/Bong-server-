const mineflayer = require('mineflayer');

class BotWrapper {
    constructor(username = 'The_Bot_by_Unknown4000', host = 'creativerseSMP.aternos.me', port = 34697) {
        this.username = username;
        this.host = host;
        this.port = port;
        this.bot = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.isStarting = false;
    }

    start() {
        if (this.isStarting || this.bot) return;

        this.isStarting = true;
        console.log(`[${this.username}] Initializing connection...`);

        this.bot = mineflayer.createBot({
            host: this.host,
            port: this.port,
            username: this.username,
            auth: 'offline',
            version: '1.20.4',
            checkTimeoutInterval: 60000
        });

        this.initEvents();
    }

    initEvents() {
        this.bot.on('spawn', () => {
            this.isStarting = false;
            this.reconnectAttempts = 0;
            console.log(`[${this.username}] Spawn detected.`);
        });

        this.bot.on('login', () => {
            this.isStarting = false;
            console.log(`[${this.username}] Logged in successfully.`);
        });

        this.bot.on('end', (reason) => {
            this.isStarting = false;
            console.log(`[${this.username}] Connection ended: ${reason || 'unknown reason'}`);
            this.cleanupAndReconnect();
        });

        this.bot.on('error', (err) => {
            this.isStarting = false;
            console.error(`[${this.username}] Error: ${err && err.message ? err.message : err}`);
            this.cleanupAndReconnect();
        });

        this.bot.on('kicked', (reason, loggedIn) => {
            this.isStarting = false;
            console.warn(`[${this.username}] Kicked: ${reason} | loggedIn: ${loggedIn}`);
            this.cleanupAndReconnect();
        });
    }

    cleanupAndReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.bot) {
            try { this.bot.end(); } catch (e) {}
            this.bot = null;
        }

        this.reconnectAttempts += 1;
        const delay = Math.min(this.reconnectAttempts * 5000, 60000);

        console.log(`[${this.username}] Reconnecting in ${delay / 1000}s...`);
        this.reconnectTimer = setTimeout(() => this.start(), delay);
    }
}

const myBot = new BotWrapper(
    'The_Bot_by_Unknown4000',
    'creativerseSMP.aternos.me',
    34697
);

myBot.start();
