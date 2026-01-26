const { Server } = require('socket.io');

// Estructura en memoria para salas activas
const activeRooms = new Map();
// { roomId: { host: userId, members: [userId], playlist: [], currentVideoIndex: 0, isPlaying: false } }

function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: process.env.CLIENT_URL || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('✅ Usuario conectado:', socket.id);

        // ========== CREAR SALA ==========
        socket.on('create-room', ({ roomId, roomName, userId, userName }) => {
            activeRooms.set(roomId, {
                roomId,
                roomName,
                host: userId,
                members: [{ id: userId, name: userName, socketId: socket.id, isHost: true }],
                playlist: [],
                currentVideoIndex: 0,
                isPlaying: false,
                rankings: {}
            });

            socket.join(roomId);
            socket.emit('room-created', { roomId, room: activeRooms.get(roomId) });
            console.log(`🏠 Sala creada: ${roomId} por ${userName}`);
        });

        // ========== UNIRSE A SALA ==========
        socket.on('join-room', ({ roomId, userId, userName }) => {
            const room = activeRooms.get(roomId);

            if (!room) {
                socket.emit('error', { message: 'Sala no encontrada' });
                console.log(`❌ Sala ${roomId} no encontrada`);
                return;
            }

            // Verificar si ya está en la sala
            const existingMember = room.members.find(m => m.id === userId);
            if (!existingMember) {
                room.members.push({ id: userId, name: userName, socketId: socket.id, isHost: false });
            } else {
                // Actualizar socketId si se reconectó
                existingMember.socketId = socket.id;
            }

            socket.join(roomId);

            // Enviar estado actual de la sala al usuario que se une
            socket.emit('room-joined', { room });

            // Notificar a todos los demás miembros
            socket.to(roomId).emit('member-joined', {
                member: { id: userId, name: userName, socketId: socket.id, isHost: false },
                members: room.members
            });

            console.log(`👤 ${userName} se unió a sala ${roomId}`);
        });

        // ========== AÑADIR VIDEO ==========
        socket.on('add-video', ({ roomId, video }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            const videoWithUuid = { ...video, uuid: crypto.randomUUID() };
            room.playlist.push(videoWithUuid);

            // Sincronizar con todos en la sala
            io.to(roomId).emit('playlist-updated', { playlist: room.playlist });
            console.log(`🎬 Video añadido a sala ${roomId}`);
        });

        // ========== ESTABLECER PLAYLIST ==========
        socket.on('set-playlist', ({ roomId, playlist }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.playlist = playlist.map(v => ({ ...v, uuid: crypto.randomUUID() }));
            room.currentVideoIndex = 0;

            io.to(roomId).emit('playlist-updated', { playlist: room.playlist });
            console.log(`📝 Playlist establecida en sala ${roomId} (${playlist.length} videos)`);
        });

        // ========== PLAY ==========
        socket.on('play-video', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.isPlaying = true;
            io.to(roomId).emit('video-playing', { isPlaying: true });
            console.log(`▶️ Play en sala ${roomId}`);
        });

        // ========== PAUSE ==========
        socket.on('pause-video', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.isPlaying = false;
            io.to(roomId).emit('video-paused', { isPlaying: false });
            console.log(`⏸️ Pause en sala ${roomId}`);
        });

        // ========== SIGUIENTE VIDEO ==========
        socket.on('next-video', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            if (room.currentVideoIndex < room.playlist.length - 1) {
                room.currentVideoIndex++;
                room.isPlaying = true;
                io.to(roomId).emit('video-changed', {
                    currentVideoIndex: room.currentVideoIndex,
                    isPlaying: true
                });
                console.log(`⏭️ Siguiente video en sala ${roomId} (índice: ${room.currentVideoIndex})`);
            } else {
                // Fin de playlist
                room.isPlaying = false;
                io.to(roomId).emit('playlist-ended');
                console.log(`🏁 Playlist terminada en sala ${roomId}`);
            }
        });

        // ========== VIDEO ANTERIOR ==========
        socket.on('previous-video', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.currentVideoIndex = Math.max(0, room.currentVideoIndex - 1);
            io.to(roomId).emit('video-changed', {
                currentVideoIndex: room.currentVideoIndex
            });
            console.log(`⏮️ Video anterior en sala ${roomId} (índice: ${room.currentVideoIndex})`);
        });

        // ========== IR A VIDEO ==========
        socket.on('go-to-video', ({ roomId, index }) => {
            const room = activeRooms.get(roomId);
            if (!room || index < 0 || index >= room.playlist.length) return;

            room.currentVideoIndex = index;
            room.isPlaying = true;
            io.to(roomId).emit('video-changed', {
                currentVideoIndex: room.currentVideoIndex,
                isPlaying: true
            });
            console.log(`🎯 Ir a video ${index} en sala ${roomId}`);
        });

        // ========== RANKING ==========
        socket.on('rank-video', ({ roomId, videoId, userId, score }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            if (!room.rankings[videoId]) {
                room.rankings[videoId] = {};
            }
            room.rankings[videoId][userId] = score;

            // Notificar a todos
            io.to(roomId).emit('ranking-updated', {
                videoId,
                rankings: room.rankings[videoId]
            });
            console.log(`⭐ Ranking actualizado en sala ${roomId} - Video: ${videoId}, Score: ${score}`);
        });

        // ========== SALIR DE SALA ==========
        socket.on('leave-room', ({ roomId, userId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.members = room.members.filter(m => m.id !== userId);
            socket.leave(roomId);

            if (room.members.length === 0) {
                // Eliminar sala si está vacía
                activeRooms.delete(roomId);
                console.log(`🗑️ Sala ${roomId} eliminada (vacía)`);
            } else {
                // Notificar a los demás
                io.to(roomId).emit('member-left', {
                    userId,
                    members: room.members
                });

                // Si el host se fue, asignar nuevo host
                if (room.host === userId && room.members.length > 0) {
                    room.host = room.members[0].id;
                    room.members[0].isHost = true;
                    io.to(roomId).emit('new-host', {
                        hostId: room.host,
                        members: room.members
                    });
                    console.log(`👑 Nuevo host en sala ${roomId}: ${room.members[0].name}`);
                }
            }
            console.log(`👋 Usuario ${userId} salió de sala ${roomId}`);
        });

        // ========== DESCONEXIÓN ==========
        socket.on('disconnect', () => {
            console.log('❌ Usuario desconectado:', socket.id);

            // Buscar en qué sala estaba y removerlo
            activeRooms.forEach((room, roomId) => {
                const member = room.members.find(m => m.socketId === socket.id);
                if (member) {
                    room.members = room.members.filter(m => m.socketId !== socket.id);

                    if (room.members.length === 0) {
                        activeRooms.delete(roomId);
                        console.log(`🗑️ Sala ${roomId} eliminada (vacía por desconexión)`);
                    } else {
                        io.to(roomId).emit('member-left', {
                            userId: member.id,
                            members: room.members
                        });

                        // Si el host se desconectó, asignar nuevo host
                        if (room.host === member.id && room.members.length > 0) {
                            room.host = room.members[0].id;
                            room.members[0].isHost = true;
                            io.to(roomId).emit('new-host', {
                                hostId: room.host,
                                members: room.members
                            });
                            console.log(`👑 Nuevo host en sala ${roomId} (por desconexión): ${room.members[0].name}`);
                        }
                    }
                }
            });
        });
    });

    return io;
}

module.exports = setupSocket;
