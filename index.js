const mineflayer = require('mineflayer');

// --- CONFIGURATION ---
const SERVER_IP = '51.79.228.227:14014'; // Change to your IP
const SERVER_PORT = 25565;            // Default Minecraft port
const BOT_USERNAME = 'Lullu_modhu';      // Bot's ingame name

function createBot() {
    console.log(`[SYSTEM] Connecting to ${SERVER_IP}...`);
    
    const bot = mineflayer.createBot({
        host: SERVER_IP,
        port: SERVER_PORT,
        username: BOT_USERNAME,
        version: '1.19.4', // Matching the version from your original code
        hideErrors: true
    });

    let afkInterval;

    // Triggered when the bot successfully connects
    bot.on('login', () => {
        console.log(`[+] ${bot.username} connected to the server!`);
    });

    // Triggered when the bot fully loads into the world
    bot.on('spawn', () => {
        console.log(`[+] ${bot.username} spawned. Starting AFK routine...`);
        
        if (afkInterval) clearInterval(afkInterval);
        
        // Ghost AFK: Swing arm and twitch camera every 15 seconds
        afkInterval = setInterval(() => {
            if (!bot.entity) return;
            
            bot.swingArm('right');
            const yawShift = bot.entity.yaw + (Math.random() > 0.5 ? 0.2 : -0.2);
            bot.look(yawShift, bot.entity.pitch, true).catch(() => {});
        }, 15000); 
    });

    // Auto-reconnect logic if kicked or server restarts
    bot.on('end', (reason) => {
        console.log(`[-] Bot disconnected. Reason: ${reason}`);
        console.log(`[SYSTEM] Reconnecting in 10 seconds...`);
        
        if (afkInterval) clearInterval(afkInterval);
        setTimeout(createBot, 10000);
    });

    // Error handling to prevent the script from crashing
    bot.on('error', (err) => {
        console.log(`[!] Error encountered: ${err.message}`);
    });
}

// Start the bot
createBot();