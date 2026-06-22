const mineflayer = require('mineflayer');

class BotWrapper {
    constructor(username, host, port) {
        this.username = "The_Bot_by_Unknown4000"; 
        this.host = "creativerseSMP.aternos.me"; 
        this.port = 34697;
        this.bot = null;
        this.reconnectAttempts = 0;
    }

    start() {
        console.log(`[${this.username}] Initializing connection...`);
        this.bot = mineflayer.createBot({
            host: this.host,
            port: this.port,
            username: this.username,
            auth: 'offline',
            version: 26.1.2, // Auto-detects the latest/correct version
            checkTimeoutInterval: 60000
        });

        this.initEvents();
    }

    initEvents() {
        this.bot.on('spawn', () => {
            console.log(`[${this.username}] Spawn detected.`);
            this.reconnectAttempts = 0;
        });

        this.bot.on('end', () => {
            this.cleanupAndReconnect();
        });

        this.bot.on('error', (err) => {
            console.error(`[${this.username}] Error: ${err.message}`);
            this.cleanupAndReconnect();
        });
    }

    cleanupAndReconnect() {
        // Safely kill instance
        if (this.bot) {
            try { this.bot.end(); } catch (e) {}
            this.bot = null;
        }

        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 5000, 60000);
        
        console.log(`[${this.username}] Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => this.start(), delay);
    }
}

// Start the bot
const myBot = new BotWrapper();
myBot.start();
