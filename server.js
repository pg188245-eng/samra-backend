const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: process.env.PORT || 8080 });

// Ek chhota sa temporary database (RAM) jo naam aur unke count yaad rakhega
const userCounts = {}; // Yahan store hoga jaise: { "samra": 3, "dubai": 1 }
const clients = new Map(); // Connected users ki list

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            // 1. Agar user NAYI ID banane ki request bhej raha hai
            if (data.type === 'REGISTER_NEW_USER') {
                const baseName = data.baseName.toLowerCase().trim(); // jaise "samra"
                
                // Check karo yeh naam pehle kitni baar aa chuka hai
                if (userCounts[baseName]) {
                    userCounts[baseName]++; // Agar pehle se hai toh count badha do
                } else {
                    userCounts[baseName] = 1; // Agar naya hai toh count 1 kar do
                }

                // Final ID banao (jaise "samra_2")
                const finalUserId = `${baseName}_${userCounts[baseName]}`;
                
                // User ko uski nayi ID wapas bhej do
                ws.send(JSON.stringify({
                    type: 'REGISTRATION_SUCCESS',
                    finalId: finalUserId
                }));
            }

            // ... (Aapka baaki ka WebRTC signaling logic jaise offer, answer yahan rahega) ...

        } catch (error) {
            console.error("Error:", error);
        }
    });

    ws.on('close', () => {
        // ... (Client disconnect handle karne ka logic) ...
    });
});

console.log("Trust Server with Auto-Numbering started!");
