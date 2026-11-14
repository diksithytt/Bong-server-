const http = require('http');
const mineflayer = require('mineflayer');

const PORT = process.env.PORT || 10000;
const HOST = process.env.MC_HOST || 'tokiyo.cogweb.store';
const MC_PORT = Number.parseInt(process.env.MC_PORT || '25565', 10);
const BOT_COUNT = Math.min(5, Math.max(1, Number.parseInt(process.env.BOT_COUNT || '5', 10) || 5));
const USERNAME_PREFIX = (process.env.BOT_USERNAME_PREFIX || 'Bot_AFK_').slice(0, 14);
const START_DELAY_MS = Math.max(15000, Number.parseInt(process.env.BOT_START_DELAY_MS || '20000', 10) || 20000);
const RECONNECT_BASE_MS = Math.max(20000, Number.parseInt(process.env.RECONNECT_BASE_MS || '30000', 10) || 30000);
const MAX_RECONNECT_MS = 120000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot service is running\n');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP] Web server listening on port ${PORT}`);
});

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
        noPongTimeout: 60000
      });

      this.bot = bot;
      this.installMovementPacketFilter(bot);

      bot.once('spawn', () => {
        this.reconnectAttempts = 0;
        console.log(`[${this.username}] Joined and spawned. Keeping AFK.`);
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
      });
    } catch (err) {
      console.error(`[${this.username}] Could not start: ${err.message}`);
      this.cleanupBot();
      this.scheduleReconnect();
    }
  }

  installMovementPacketFilter(bot) {
    let allowNextPositionPacket = false;
    const originalWrite = bot._client.write.bind(bot._client);

    bot._client.on('position', () => {
      allowNextPositionPacket = true;
    });

    bot._client.write = (name, params) => {
      if (name === 'position' || name === 'position_look' || name === 'look' || name === 'flying') {
        if (!allowNextPositionPacket) return;
        allowNextPositionPacket = false;
        originalWrite(name, params);

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
        this.bot.swingArm();
      } catch (_) {}
    }, 60000);
  }

  cleanupBot() {
    if (this.antiAfkTimer) {
      clearInterval(this.antiAfkTimer);
      this.antiAfkTimer = null;
    }

    const bot = this.bot;
    this.bot = null;

    if (bot) {
      try {
        bot.removeAllListeners();
        bot.quit();
      } catch (_) {}
    }
  }

  scheduleReconnect() {
    if (this.stopping || this.reconnectScheduled) return;

    this.reconnectScheduled = true;
    this.reconnectAttempts += 1;

    const backoff = RECONNECT_BASE_MS * Math.min(this.reconnectAttempts, 4);
    const delay = Math.min(backoff, MAX_RECONNECT_MS);
    const jittered = Math.round(delay * (0.85 + Math.random() * 0.3));

    console.log(`[${this.username}] Reconnecting in ${Math.round(jittered / 1000)}s...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectScheduled = false;
      this.reconnectTimer = null;
      this.start();
    }, jittered);
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

const bots = Array.from({ length: BOT_COUNT }, (_, index) =>
  new BotWrapper(`${USERNAME_PREFIX}${index + 1}`)
);

bots.forEach((bot, index) => {
  setTimeout(() => bot.start(), index * START_DELAY_MS);
});

function shutdown() {
  bots.forEach((bot) => bot.stop());
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
