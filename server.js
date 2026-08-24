const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.get('/', (req, res) => {
    res.send('Project Samra Relay Server is Active & Secure!');
});

wss.on('connection', (ws) => {
    console.log('New client connected!');

    ws.on('message', (message) => {
        // Broadcast message to all other connected clients
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message.toString());
            }
        });
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
