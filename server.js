const mineflayer = require('mineflayer');

class AFKBot {
  constructor(config = {}) {
    this.host = config.host || 'creativerseSMP.aternos.me';
    this.port = config.port || 34697;
    this.username = config.username || 'BongAFK';
    this.auth = config.auth || 'offline';
    this.version = config.version ?? false; // false lets Mineflayer auto-detect

    this.bot = null;
    this.afkInterval = null;
    this.reconnectTimeout = null;
    this.reconnectAttempts = 0;
    this.isReconnecting = false;

    this.initBot();
  }

  initBot() {
    this.isReconnecting = false;
    console.log(`[${this.username}] Initializing connection to ${this.host}:${this.port}...`);

    this.bot = mineflayer.createBot({
      host: this.host,
      port: this.port,
      username: this.username,
      auth: this.auth,
      version: this.version,
      checkTimeoutInterval: 60000
    });

    this.initEvents();
  }

  initEvents() {
    this.bot.once('spawn', () => {
      console.log(`[${this.username}] Spawn detected. Bot active.`);
      this.reconnectAttempts = 0;
      this.startAfkRoutine();
    });

    this.bot.on('kicked', (reason) => {
      console.warn(`[${this.username}] Kicked: ${reason}`);
    });

    this.bot.on('end', () => {
      console.log(`[${this.username}] Connection terminated.`);
      this.cleanupAndReconnect();
    });

    this.bot.on('error', (err) => {
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
    const delay = Math.min(5000 + (this.reconnectAttempts * 2000), 30000);
    console.log(`[${this.username}] Attempting reconnection #${this.reconnectAttempts} in ${delay / 1000}s...`);

    this.reconnectTimeout = setTimeout(() => {
      this.initBot();
    }, delay);
  }
}

const botInstance = new AFKBot({
  host: 'creativerseSMP.aternos.me',
  port: 34697,
  username: 'BongAFK',
  auth: 'offline',
  version: false
});
