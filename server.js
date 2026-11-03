const mineflayer = require('mineflayer');

class AFKBot {
  constructor(config = {}) {
    this.host = config.host || 'jadesmp.mcsh.gg';
    this.port = config.port || 25565;
    this.username = config.username || 'BongAFK';
    this.auth = config.auth || 'offline';
    this.version = config.version ?? false;

    this.bot = null;
    this.afkInterval = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.connected = false;

    this.start();
  }

  start() {
    this.isReconnecting = false;
    this.connected = false;
    console.log(`[${this.username}] Initializing connection to ${this.host}:${this.port}...`);

    this.bot = mineflayer.createBot({
      host: this.host,
      port: this.port,
      username: this.username,
      auth: this.auth,
      version: this.version,
      checkTimeoutInterval: 60000,
      disableChatSigning: true
    });

    this.initEvents();
  }

  initEvents() {
    this.bot.once('spawn', () => {
      this.connected = true;
      console.log(`[${this.username}] Spawn detected. Bot active.`);
      this.reconnectAttempts = 0;
      this.startAfkRoutine();
    });

    this.bot.on('kicked', (reason) => {
      console.warn(`[${this.username}] Kicked: ${reason}`);
      this.connected = false;
    });

    this.bot.on('end', () => {
      this.connected = false;
      console.log(`[${this.username}] Connection terminated.`);
      this.cleanupAndReconnect();
    });

    this.bot.on('error', (err) => {
      this.connected = false;
      console.error(`[${this.username}] Error: ${err.message}`);
      this.cleanupAndReconnect();
    });
  }

  startAfkRoutine() {
    this.stopAfkRoutine();

    const movements = ['forward', 'back', 'left', 'right', 'jump', 'sneak'];

    this.afkInterval = setInterval(() => {
      if (!this.bot || !this.bot.entity) return;

      const action = movements[Math.floor(Math.random() * movements.length)];
      this.bot.setControlState(action, true);

      const yaw = (Math.random() * Math.PI * 2) - Math.PI;
      const pitch = (Math.random() * 0.4) - 0.2;
      this.bot.look(yaw, pitch, false).catch(() => {});

      setTimeout(() => {
        if (this.bot && this.bot.entity) {
          this.bot.setControlState(action, false);
        }
      }, Math.floor(Math.random() * 400) + 300);
    }, 3500);
  }

  stopAfkRoutine() {
    if (this.afkInterval) {
      clearInterval(this.afkInterval);
      this.afkInterval = null;
    }
  }

  cleanupAndReconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;

    this.stopAfkRoutine();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

    if (this.bot) {
      this.bot.removeAllListeners();
      try {
        this.bot.quit();
      } catch (_) {}
      this.bot = null;
    }

    this.reconnectAttempts++;
    const delay = Math.min(5000 + this.reconnectAttempts * 2000, 30000);
    console.log(`[${this.username}] Attempting reconnection #${this.reconnectAttempts} in ${delay / 1000}s...`);

    this.reconnectTimeout = setTimeout(() => {
      this.start();
    }, delay);
  }
}

const botInstance = new AFKBot({
  host: 'jadesmp.mcsh.gg',
  port: 25565,
  username: 'BongAFK',
  auth: 'offline',
  version: false
});

module.exports = botInstance;
