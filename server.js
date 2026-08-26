const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;
const clients = new Map(); // Connected users ki list (UserId -> Socket)

// 1. Express ka HTTP route
app.get('/', (req, res) => {
    res.send('Trust Signaling Server is running successfully!');
});

// 2. WebSocket Connection Logic
wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => ws.isAlive = true);
    
    let currentUserId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 🌟 STEP A: Jab App connect ho toh apna User ID Register kare
            if (data.type === 'register') {
                currentUserId = data.userId;
                clients.set(currentUserId, ws);
                console.log(`✅ User Registered: ${currentUserId}`);
                return;
            }

            // 🌟 STEP B: Jab ek User kisi doosre ko Call lagaye (Offer, Answer, Candidate)
            if (data.targetId) {
                const targetSocket = clients.get(data.targetId);
                
                // Agar target user online hai, toh usko exact wahi message bhej do
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(message.toString());
                    console.log(`📤 Message from ${data.senderId} forwarded to ${data.targetId}`);
                } else {
                    console.log(`⚠️ User ${data.targetId} is offline or not found.`);
                }
            }

        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    // Jab user app band karde ya disconnect ho jaye
    ws.on('close', () => {
        if (currentUserId && clients.has(currentUserId)) {
            clients.delete(currentUserId);
            console.log(`❌ User Disconnected: ${currentUserId}`);
        }
    });
});

// Har 30 seconds mein inactive connections saaf karo
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

ws.on('close', () => {
        // 🌟 NAYA LOGIC: Sirf tab delete karo jab map mein current socket hi maujood ho
        if (currentUserId && clients.get(currentUserId) === ws) {
            clients.delete(currentUserId);
            console.log(`❌ User Disconnected: ${currentUserId}`);
        }
    });
