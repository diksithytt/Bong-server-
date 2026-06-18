const mineflayer = require('mineflayer');

class BotWrapper {
    constructor(username, host, port, password) {
        this.username = "The_Bot"; // Quotes added
        this.host = "15.235.144.117"; // Quotes added
        this.port = 12463;
        this.password = "Please"; // Quotes added
        this.bot = null;
        this.reconnectAttempts = 0;
        this.isLoggedIn = false; // Prevents spamming login
    }

    start() {
        this.isLoggedIn = false;
        console.log(`[${this.username}] Initializing connection...`);
        this.bot = mineflayer.createBot({
            host: this.host,
            port: this.port,
            username: this.username,
            auth: 'offline',
            checkTimeoutInterval: 60000
        });

        this.initEvents();
    }

    initEvents() {
        this.bot.on('spawn', () => {
            console.log(`[${this.username}] Spawn detected.`);
            this.sendLogin();
            this.reconnectAttempts = 0;
        });

        this.bot.on('message', (jsonMsg) => {
            if (this.isLoggedIn) return; // Ignore messages if we are already in

            const message = jsonMsg.toString();
            if (/log(in|ged)|pass(word)?|register/i.test(message)) {
                console.log(`[${this.username}] Auth prompt detected.`);
                this.sendLogin();
            }
        });

        this.bot.on('end', () => {
            this.isLoggedIn = false;
            this.cleanupAndReconnect();
        });

        this.bot.on('error', (err) => {
            console.error(`[${this.username}] Error: ${err.message}`);
            this.cleanupAndReconnect();
        });
    }

    sendLogin() {
        // SAFETY GUARD: If bot is null or not connected, abort
        if (!this.bot || this.isLoggedIn) return;

        console.log(`[${this.username}] Sending credentials...`);
        this.bot.chat(`/login ${this.password}`);
        this.isLoggedIn = true; // Mark as logged in to stop chat spam
    }

    cleanupAndReconnect() {
        this.isLoggedIn = false;
        
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
