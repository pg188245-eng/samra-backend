const WebSocket = require('ws');
const server = require('http').createServer();
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8080;

const userCounts = {}; 
const clients = new Map(); // Connected users ki list

// Render par WebSocket connection zinda rakhne ke liye Heartbeat function
function heartbeat() {
    this.isAlive = true;
}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', heartbeat);

    console.log('Ek naya client connect ho gaya hai!');
    let currentUserId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. User Registration Logic
            if (data.type === 'REGISTER_NEW_USER') {
                if (!data.baseName) {
                    ws.send(JSON.stringify({ type: 'ERROR', message: 'BaseName is required' }));
                    return;
                }

                const baseName = data.baseName.toLowerCase().trim();
                
                if (userCounts[baseName]) {
                    userCounts[baseName]++; 
                } else {
                    userCounts[baseName] = 1; 
                }

                currentUserId = `${baseName}_${userCounts[baseName]}`;
                clients.set(currentUserId, ws);

                ws.send(JSON.stringify({
                    type: 'REGISTRATION_SUCCESS',
                    finalId: currentUserId
                }));

                console.log(`Registered successfully: ${currentUserId}`);
            }

            // 2. WebRTC Signaling Logic (Offer / Answer / ICE Candidates)
            if (data.type === 'SEND_SIGNAL') {
                if (!data.targetId || !data.payload) return;
                
                const targetSocket = clients.get(data.targetId);
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: 'RECEIVE_SIGNAL',
                        from: currentUserId,
                        payload: data.payload
                    }));
                }
            }

        } catch (error) {
            console.error("Error processing message:", error);
        }
    });

    // Jab user disconnect ho jaye
    ws.on('close', () => {
        if (currentUserId && clients.has(currentUserId)) {
            clients.delete(currentUserId);
            console.log(`Client disconnect ho gaya: ${currentUserId}`);
        }
    });
});

// Har 30 seconds mein check karo kaunsa client zinda hai (Render ke liye zaroori)
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});

// Server ko port par listen karwao
server.listen(PORT, () => {
    console.log(`WebSocket Server started successfully on port: ${PORT}`);
});
