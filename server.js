const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mineflayer = require('mineflayer');
const path = require('path');

// --- 1. WEB SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Tell the server to show the 'public' folder when someone visits the website
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. BOT CONFIGURATION ---
const SERVER_IP = '51.79.228.227';    
const SERVER_PORT = 14014;            
const BOT_USERNAME = 'VENOM';  

let bot;
let afkInterval;

function createBot() {
    console.log(`[SYSTEM] Connecting to ${SERVER_IP}...`);
    
    bot = mineflayer.createBot({
        host: SERVER_IP,
        port: SERVER_PORT,
        username: BOT_USERNAME,
        version: '1.19.4',
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
        
        // Ghost AFK Routine: Swing arm and look around every 15 seconds
        afkInterval = setInterval(() => {
            if (!bot.entity) return;
            bot.swingArm('right');
            const yawShift = bot.entity.yaw + (Math.random() > 0.5 ? 0.2 : -0.2);
            bot.look(yawShift, bot.entity.pitch, true).catch(() => {});
        }, 15000); 
    });

    bot.on('message', (message) => {
        const text = message.toString().trim();
        if (text) {
            io.emit('mcChat', text);
        }
    });

    bot.on('end', (reason) => {
        const msg = `[-] Bot disconnected. Reason: ${reason}. Reconnecting in 10s...`;
        console.log(msg);
        io.emit('sysLog', msg);
        
        if (afkInterval) clearInterval(afkInterval);
        setTimeout(createBot, 10000);
    });

    bot.on('error', (err) => {
        console.log(`[!] Error: ${err.message}`);
    });
}

// --- 3. LIVE CHAT SYSTEM ---
io.on('connection', (socket) => {
    console.log('[SYSTEM] A user opened the web dashboard.');
    
    socket.on('sendChat', (msg) => {
        if (bot && bot.entity) {
            bot.chat(msg);
        } else {
            socket.emit('sysLog', '[!] Cannot send message. Bot is offline.');
        }
    });
});

// --- 4. START EVERYTHING ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`[SYSTEM] Web Dashboard running on port ${PORT}`);
    console.log(`===========================================`);
    createBot();
});