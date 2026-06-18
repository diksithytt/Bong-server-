const mineflayer = require('mineflayer');

class BotWrapper {
    constructor(username, host, port, password) {
        this.username = The_Bot;
        this.host = "15.235.144.117";
        this.port = 12463;
        this.password = "Please";
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
            // Set version to false to auto-detect protocol; 
            // if you get version errors, hardcode it (e.g., '1.21.1')
            version: false, 
            checkTimeoutInterval: 60000
        });

        this.initEvents();
    }

    initEvents() {
        this.bot.on('spawn', () => {
            console.log(`[${this.username}] Spawn detected.`);
            // Aggressive attempt 1: Login immediately on spawn
            this.sendLogin();
            this.reconnectAttempts = 0; // Reset counter
        });

        this.bot.on('message', (jsonMsg) => {
            const message = jsonMsg.toString();
            // Aggressive attempt 2: Regex login detection (more precise than .includes)
            if (/log(in|ged)|pass(word)?|register/i.test(message)) {
                console.log(`[${this.username}] Auth prompt detected: "${message}"`);
                this.sendLogin();
            }
        });

        this.bot.on('kicked', (reason) => {
            console.log(`[${this.username}] Kicked: ${reason}`);
            this.cleanupAndReconnect();
        });

        this.bot.on('error', (err) => {
            console.error(`[${this.username}] Error: ${err.message}`);
            this.cleanupAndReconnect();
        });

        this.bot.on('end', () => {
            console.log(`[${this.username}] Connection ended.`);
            this.cleanupAndReconnect();
        });
    }

    sendLogin() {
        // Multi-stage login to ensure it gets through
        setTimeout(() => this.bot.chat(`/login ${this.password}`), 500);
        setTimeout(() => this.bot.chat(`/register ${this.password} ${this.password}`), 1000);
    }

    cleanupAndReconnect() {
        // Safely kill the old instance
        if (this.bot) {
            try {
                this.bot.quit();
                this.bot.end();
            } catch (e) {
                console.log(`[${this.username}] Clean-up warning: ${e.message}`);
            }
        }

        // Incremental Backoff: Wait 5s, then 10s, max 60s
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectAttempts * 5000, 60000);
        
        console.log(`[${this.username}] Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => this.start(), delay);
    }
}

// Start the bot
const myBot = new BotWrapper('YourBotName', 'YOUR_SERVER_IP', 25565, 'Please');
myBot.start();
