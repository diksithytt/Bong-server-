const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// --- BOT CONFIGURATION ---
const SERVER_IP = '51.79.228.227:14014';    
const SERVER_PORT = 14014;            
const BOT_USERNAME = 'BONG_AFK_Bot';  

let bot;
let afkInterval;
let allowReconnect = true; // Tracks if the bot SHOULD auto-reconnect

function createBot() {
    // Prevent creating multiple bot instances at the same time
    if (bot && bot.entity) {
        io.emit('sysLog', '[!] Bot is already running.');
        return;
    }

    console.log(`[SYSTEM] Connecting to ${SERVER_IP}...`);
    io.emit('sysLog', `[SYSTEM] Attempting to connect to ${SERVER_IP}...`);
    
    bot = mineflayer.createBot({
        host: SERVER_IP,
        port: SERVER_PORT,
        username: BOT_USERNAME,
        version: '1.21.11',
        hideErrors: true
    });

    bot.on('login', () => {
        const msg = `[+] SUCCESS! ${bot.username} connected to the server!`;
        console.log(msg);
        io.emit('sysLog', msg);
    });

    bot.on('spawn', () => {
        const msg = `[+] ${bot.username} spawned. Starting AFK twitch routine...`;
        console.log(msg);
        io.emit('sysLog', msg);
        
        if (afkInterval) clearInterval(afkInterval);
        
        afkInterval = setInterval(() => {
            if (!bot.entity) return;
            bot.swingArm('right');
            const yawShift = bot.entity.yaw + (Math.random() > 0.5 ? 0.2 : -0.2);
            bot.look(yawShift, bot.entity.pitch, true).catch(() => {});
        }, 15000); 
    });

    bot.on('message', (message) => {
        const text = message.toString().trim();
        if (text) io.emit('mcChat', text);
    });

    bot.on('end', (reason) => {
        const msg = `[-] Bot disconnected. Reason: ${reason}`;
        console.log(msg);
        io.emit('sysLog', msg);
        
        if (afkInterval) clearInterval(afkInterval);
        
        // Only reconnect automatically if we didn't manually press Disconnect
        if (allowReconnect) {
            io.emit('sysLog', '[SYSTEM] Reconnecting automatically in 10s...');
            setTimeout(createBot, 10000);
        } else {
            io.emit('sysLog', '[SYSTEM] Bot is resting. Press CONNECT to start again.');
        }
    });

    bot.on('error', (err) => console.log(`[!] Error: ${err.message}`));
}

// --- LIVE INTERACTION LINK ---
io.on('connection', (socket) => {
    console.log('[SYSTEM] A user opened the web dashboard.');
    
    // Listen for CONNECT button
    socket.on('manualConnect', () => {
        allowReconnect = true;
        if (!bot || !bot.entity) {
            createBot();
        } else {
            socket.emit('sysLog', '[!] Bot is already online.');
        }
    });

    // Listen for DISCONNECT button
    socket.on('manualDisconnect', () => {
        allowReconnect = false; // Turn off auto-reconnect loop
        if (bot) {
            bot.end('Manual Disconnect Requested via Dashboard');
            bot = null;
        } else {
            socket.emit('sysLog', '[!] Bot is already offline.');
        }
    });

    // Send chat message
    socket.on('sendChat', (msg) => {
        if (bot && bot.entity) {
            bot.chat(msg);
        } else {
            socket.emit('sysLog', '[!] Cannot send message. Bot is offline.');
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[SYSTEM] Web Dashboard running on port ${PORT}`);
    createBot(); // Automatically logs in on system startup
});
