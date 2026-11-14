const http = require('http');
const mineflayer = require('mineflayer');

// Keep Render's web service responsive with a minimal health endpoint.
const PORT = process.env.PORT || 10000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot service is running\n');
});
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] Listening on port ${PORT}`);
});

const HOST = process.env.MC_HOST || 'tokiyo.cogweb.store';
const MC_PORT = Number.parseInt(process.env.MC_PORT || '25565', 10);
const BOT_COUNT = Math.min(5, Math.max(1, Number.parseInt(process.env.BOT_COUNT || '3', 10) || 3));
const USERNAME_PREFIX = (process.env.BOT_USERNAME_PREFIX || 'Bot_AFK_').slice(0, 14);
const START_DELAY_MS = Math.max(10000, Number.parseInt(process.env.BOT_START_DELAY_MS || '15000', 10) || 15000);
const RECONNECT_BASE_MS = Math.max(30000, Number.parseInt(process.env.RECONNECT_BASE_MS || '30000', 10) || 30000);
const MAX_RECONNECT_MS = 5 * 60 * 1000;

class BotWrapper {
    constructor(username) {
        this.username = username;
        this.bot = null;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.antiAfkTimer = null;
        this.reconnectScheduled = false;
        this.stopping = false;
    }

    start() {
        if (this.stopping || this.bot || this.reconnectScheduled) return;

        console.log(`[${this.username}] Connecting to ${HOST}:${MC_PORT}...`);
        try {
            const bot = mineflayer.createBot({
                host: HOST,
                port: MC_PORT,
                username: this.username,
                auth: 'offline',
                version: false,
                checkTimeoutInterval: 60000,
                physicsEnabled: false,
                // Skip loading chunks/world data; this bot only needs to remain connected.
                loadInternalPlugins: false,
                plugins: {
                    chat: false,
                    tablist: false,
                    scoreboard: false,
                    bossbar: false,
                    book: false,
                    chest: false,
                    digging: false,
                    fishing: false,
                    gameplay: false,
                    health: false,
                    inventory: false,
                    place_block: false,
                    resource_pack: false,
                    particle: false,
                    sound: false,
                    team: false,
                    title: false,
                    block_actions: false,
                    blocks: false,
                    entities: false,
                    experience: false,
                    settings: false,
                    simple_inventory: false,
                    physics: false
                }
            });
            this.bot = bot;

            bot.once('spawn', () => {
                this.reconnectAttempts = 0;
                console.log(`[${this.username}] Joined.`);
                this.startAntiAfk();
            });
            bot.on('kicked', (reason) => {
                console.warn(`[${this.username}] Kicked: ${typeof reason === 'string' ? reason : JSON.stringify(reason)}`);
            });
            bot.on('end', (reason) => {
                console.log(`[${this.username}] Disconnected: ${reason || 'connection ended'}`);
                this.cleanupBot();
                this.scheduleReconnect();
            });
            bot.on('error', (err) => {
                console.error(`[${this.username}] Error: ${err.message}`);
                // The end event handles cleanup/reconnect in the normal disconnect path.
            });
        } catch (err) {
            console.error(`[${this.username}] Could not start: ${err.message}`);
            this.cleanupBot();
            this.scheduleReconnect();
        }
    }

    startAntiAfk() {
        if (this.antiAfkTimer) clearInterval(this.antiAfkTimer);
        // Avoid frequent activity packets; set to 0 to disable the arm-swing keepalive action.
        const interval = Number.parseInt(process.env.ANTI_AFK_INTERVAL_MS || '60000', 10);
        if (!interval || interval < 1000) return;
        this.antiAfkTimer = setInterval(() => {
            if (!this.bot || !this.bot.entity) return;
            try { this.bot.swingArm(); } catch (_) {}
        }, interval);
    }

    cleanupBot() {
        if (this.antiAfkTimer) {
            clearInterval(this.antiAfkTimer);
            this.antiAfkTimer = null;
        }
        const bot = this.bot;
        this.bot = null;
        if (bot) {
            try { bot.quit(); } catch (_) {}
        }
    }

    scheduleReconnect() {
        if (this.stopping || this.reconnectScheduled) return;
        this.reconnectScheduled = true;
        this.reconnectAttempts += 1;
        const exponential = RECONNECT_BASE_MS * (2 ** Math.min(this.reconnectAttempts - 1, 4));
        const delay = Math.min(exponential, MAX_RECONNECT_MS);
        // Add jitter to avoid all bots retrying at once.
        const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
        console.log(`[${this.username}] Reconnecting in ${Math.round(jitteredDelay / 1000)}s...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectScheduled = false;
            this.reconnectTimer = null;
            this.start();
        }, jitteredDelay);
    }

    stop() {
        this.stopping = true;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        this.reconnectScheduled = false;
        this.cleanupBot();
    }
}

const bots = Array.from({ length: BOT_COUNT }, (_, index) =>
    new BotWrapper(`${USERNAME_PREFIX}${index + 1}`)
);
bots.forEach((bot, index) => setTimeout(() => bot.start(), index * START_DELAY_MS));

function shutdown() {
    bots.forEach((bot) => bot.stop());
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
