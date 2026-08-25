const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Ek chhota sa temporary database (RAM) jo naam aur unke count yaad rakhega
const userCounts = {}; 
const clients = new Map(); // Connected users ko track karne ke liye (userId -> ws)

wss.on('connection', (ws) => {
    console.log('Ek naya client connect ho gaya hai!');
    let currentUserId = null; // Is connection ki apni ID

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. Agar user NAYI ID banane ki request bhej raha hai
            if (data.type === 'REGISTER_NEW_USER') {
                const baseName = (data.baseName || 'user').toLowerCase().trim(); // jaise "samra"
                
                // Check karo yeh naam pehle kitni baar aa chuka hai
                if (userCounts[baseName]) {
                    userCounts[baseName]++; 
                } else {
                    userCounts[baseName] = 1; 
                }

                // Final ID banao (jaise "samra_2")
                currentUserId = `${baseName}_${userCounts[baseName]}`;
                
                // Client ko Map mein save kar lo taaki baad mein message bhej sakein
                clients.set(currentUserId, ws);

                // User ko uski nayi ID wapas bhej do
                ws.send(JSON.stringify({
                    type: 'REGISTRATION_SUCCESS',
                    finalId: currentUserId
                }));

                console.log(`Registered successfully: ${currentUserId}`);
            }

            // 2. WebRTC Signaling ya baaki messages ke liye example:
            // Agar aapko kisi specific user ko offer/answer bhejna ho:
            if (data.type === 'SEND_SIGNAL') {
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
            clients.delete(currentUserId); // List se hata do
            console.log(`Client disconnect ho gaya: ${currentUserId}`);
        }
    });
});

console.log("WebSocket Server started successfully on port:", process.env.PORT || 8080);
