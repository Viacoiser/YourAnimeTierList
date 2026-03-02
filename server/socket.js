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
        socket.on('create-room', ({ roomId, userId, userName, roomName, waitMode, authUserId }) => {
            console.log(`[DEBUG] Request create-room: ID='${roomId}', User='${userName}'`);

            if (!roomId) {
                console.error('[ERROR] Room ID is missing!');
                socket.emit('error', { message: 'ID de sala inválido' });
                return;
            }

            if (activeRooms.has(roomId)) {
                console.log(`ℹ️ Sala '${roomId}' ya existe - Probablemente double-emission del cliente (ignorando)`);
                // En lugar de rechazar, simplemente enviamos confirmación de que la sala existe
                const room = activeRooms.get(roomId);
                const roomToSend = {
                    ...room,
                    roomId: room.id,
                    roomName: room.name,
                    usersReady: Array.from(room.usersReady || new Set())
                };
                socket.emit('room-created', { roomId, room: roomToSend });
                return;
            }

            const room = {
                id: roomId,
                host: userId,
                name: roomName,
                members: [],
                playlist: [],
                currentVideoIndex: 0,
                isPlaying: !waitMode, // Auto-play si NO es WaitMode
                rankings: {},
                waitMode: !!waitMode,
                usersReady: new Set()
            };

            // Añadir al creador como primer miembro (y host)
            room.members.push({
                id: userId,
                name: userName,
                socketId: socket.id,
                isHost: true,
                authUserId: authUserId || null  // Firebase UID or null for guest users
            });
            activeRooms.set(roomId, room);

            socket.join(roomId);

            // Serializar Set para envío y añadir propiedades que el cliente espera
            const roomToSend = {
                ...room,
                roomId: room.id,  // Cliente espera roomId
                roomName: room.name,  // Cliente espera roomName
                usersReady: Array.from(room.usersReady)
            };
            socket.emit('room-created', { roomId, room: roomToSend });

            console.log(`🏠 Sala creada: ${roomId} por ${userName} (WaitMode: ${room.waitMode})`);
        });

        // ========== UNIRSE A SALA ==========
        socket.on('join-room', ({ roomId, userId, userName, authUserId }) => {
            const room = activeRooms.get(roomId);

            if (!room) {
                socket.emit('error', { message: 'Sala no encontrada' });
                console.log(`❌ Sala ${roomId} no encontrada`);
                return;
            }

            // Verificar si ya está en la sala
            const existingMember = room.members.find(m => m.id === userId);
            if (!existingMember) {
                room.members.push({
                    id: userId,
                    name: userName,
                    socketId: socket.id,
                    isHost: false,
                    authUserId: authUserId || null  // Firebase UID or null for guest users
                });
            } else {
                // Actualizar socketId si se reconectó
                existingMember.socketId = socket.id;
            }

            socket.join(roomId);

            // Enviar estado actual (serializar Set y añadir propiedades que el cliente espera)
            const roomToSend = {
                ...room,
                roomId: room.id,  // Cliente espera roomId
                roomName: room.name,  // Cliente espera roomName
                usersReady: room.usersReady ? Array.from(room.usersReady) : []
            };
            socket.emit('room-joined', { room: roomToSend });

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

            // Resetear listos si WaitMode activo
            if (room.usersReady) room.usersReady.clear();
            if (room.loadingProgress) room.loadingProgress = {}; // Reset progress
            io.to(roomId).emit('users-ready-updated', { usersReady: [] });
            io.to(roomId).emit('loading-progress-updated', { progress: {}, readyCount: 0, totalCount: room.members.length });

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

        // ========== SEEK (eliminados duplicados) ==========

        // ========== SIGUIENTE VIDEO ==========
        socket.on('next-video', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            if (room.currentVideoIndex < room.playlist.length - 1) {
                room.currentVideoIndex++;
                room.isPlaying = !room.waitMode; // Auto-play solo si NO hay waitMode

                // Resetear listos
                if (room.usersReady) room.usersReady.clear();
                if (room.loadingProgress) room.loadingProgress = {}; // Reset progress
                io.to(roomId).emit('users-ready-updated', { usersReady: [] });
                io.to(roomId).emit('loading-progress-updated', { progress: {}, readyCount: 0, totalCount: room.members.length });

                io.to(roomId).emit('video-changed', {
                    currentVideoIndex: room.currentVideoIndex,
                    isPlaying: room.isPlaying
                });
                console.log(`⏭️ Siguiente video en sala ${roomId} (índice: ${room.currentVideoIndex}, Playing: ${room.isPlaying})`);
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

            // Resetear listos
            if (room.usersReady) room.usersReady.clear();
            if (room.loadingProgress) room.loadingProgress = {}; // Reset progress
            io.to(roomId).emit('users-ready-updated', { usersReady: [] });
            io.to(roomId).emit('loading-progress-updated', { progress: {}, readyCount: 0, totalCount: room.members.length });

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
            room.isPlaying = !room.waitMode; // Auto-play solo si NO hay waitMode

            // Resetear listos
            if (room.usersReady) room.usersReady.clear();
            io.to(roomId).emit('users-ready-updated', { usersReady: [] });

            io.to(roomId).emit('video-changed', {
                currentVideoIndex: room.currentVideoIndex,
                isPlaying: room.isPlaying
            });
            console.log(`🎯 Ir a video ${index} en sala ${roomId}`);
        });

        // ========== CONFIGURACIÓN SALA (NUEVO) ==========
        socket.on('update-room-settings', ({ roomId, settings }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Solo Host autorizado (aunque idealmente verificaríamos ID)
            // Actualizar settings
            if (settings.waitMode !== undefined) {
                room.waitMode = settings.waitMode;
                // Si desactivamos waitMode, limpiar listos? O mantener?
                // Mejor mantener para evitar bugs si se reactiva.
            }
            if (settings.roomName !== undefined) room.name = settings.roomName;

            // Notificar a todos con estructura correcta
            const roomToSend = {
                ...room,
                roomId: room.id,
                roomName: room.name,
                usersReady: room.usersReady ? Array.from(room.usersReady) : []
            };
            io.to(roomId).emit('room-settings-updated', { settings: roomToSend });
            console.log(`⚙️ Configuración actualizada en sala ${roomId}:`, settings);
        });

        // ========== MODO ESPERA: Lógica de "Listo" ==========
        // Deprecated: user-ready (Still keeping for backward compatibility if needed, but V2 uses progress)
        socket.on('user-ready', ({ roomId, userId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            if (!room.usersReady) room.usersReady = new Set();
            room.usersReady.add(userId);

            // Notificar progreso a todos
            io.to(roomId).emit('users-ready-updated', {
                usersReady: Array.from(room.usersReady)
            });
        });

        // V2: Progress Tracking
        socket.on('video-load-progress', ({ roomId, userId, percent }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Inicializar tracking si no existe
            if (!room.loadingProgress) {
                room.loadingProgress = {};
            }

            // Actualizar progreso del usuario
            room.loadingProgress[userId] = percent;

            // Calcular cuántos están "Ready" (>= 50%)
            const progressValues = Object.values(room.loadingProgress);
            const readyCount = progressValues.filter(p => p >= 50).length;

            // Broadcast a todos
            io.to(roomId).emit('loading-progress-updated', {
                progress: room.loadingProgress,
                readyCount: readyCount,
                totalCount: room.members.length
            });
        });

        // V2: Buffering Status
        socket.on('user-buffering', ({ roomId, userId, isBuffering }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Retransmitir a todos los demás
            socket.to(roomId).emit('user-buffering-update', {
                userId,
                isBuffering
            });
        });

        socket.on('force-start', ({ roomId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            console.log(`💪 Forzando inicio en sala ${roomId}`);
            room.isPlaying = true;
            io.to(roomId).emit('force-start-video');
            io.to(roomId).emit('video-playing');
        });

        // ========== SEEK (SALTAR TIEMPO) ==========
        socket.on('seek-video', ({ roomId, currentTime }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Broadcast a TODOS incluyendo al emisor (host)
            io.to(roomId).emit('video-seeked', { currentTime });
            console.log(`⏩ Seek a ${currentTime}s en sala ${roomId}`);
        });

        // ========== HEARTBEAT (SYNC PERIÓDICO) ==========
        socket.on('time-update', ({ roomId, currentTime }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            socket.to(roomId).emit('time-update', { currentTime });
        });

        // ========== SINCRONIZACIÓN DE TIEMPO (Nuevos usuarios) ==========
        // 1. Cuando alguien entra, el servidor pide al HOST el tiempo actual
        socket.on('request-time-sync', ({ roomId, requesterId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Buscar al host
            const host = room.members.find(m => m.isHost);
            if (host) {
                // Pedir al host que envíe su tiempo
                io.to(host.socketId).emit('get-current-time', { requesterId });
            }
        });

        // 3. El host responde y el servidor reenvía al usuario específico
        socket.on('sync-time-response', ({ roomId, requesterId, currentTime }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            // Buscar socket del solicitante
            const requester = room.members.find(m => m.id === requesterId);
            if (requester) {
                io.to(requester.socketId).emit('video-seeked', { currentTime });
                console.log(`🕒 Sincronizando usuario ${requesterId} a ${currentTime}s`);
            }
        });

        // ========== RANKING ==========
        socket.on('rank-video', ({ roomId, videoId, userId, tier }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            console.log(`⭐ Ranking: Sala ${roomId}, Video ${videoId}, User ${userId}, Tier ${tier}`);

            // Inicializar ranking para este video
            if (!room.rankings[videoId]) {
                room.rankings[videoId] = {};
            }

            // Guardar el tier del usuario para este video
            room.rankings[videoId][userId] = tier;

            // Notificar a todos
            io.to(roomId).emit('ranking-updated', {
                videoId,
                rankings: room.rankings[videoId]
            });
            console.log(`⭐ Ranking actualizado en sala ${roomId} - Video: ${videoId}, Tier: ${tier}`);
        });

        // ========== SALIR DE SALA ==========
        socket.on('leave-room', ({ roomId, userId }) => {
            const room = activeRooms.get(roomId);
            if (!room) return;

            room.members = room.members.filter(m => m.id !== userId);

            // Clean up progress
            if (room.loadingProgress && room.loadingProgress[userId]) {
                delete room.loadingProgress[userId];
            }

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

                // Broadcast updated progress since member count decreased
                if (room.loadingProgress) {
                    const progressValues = Object.values(room.loadingProgress);
                    const readyCount = progressValues.filter(p => p >= 50).length;
                    io.to(roomId).emit('loading-progress-updated', {
                        progress: room.loadingProgress,
                        readyCount: readyCount,
                        totalCount: room.members.length
                    });
                }

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

                    // Clean up progress
                    if (room.loadingProgress && room.loadingProgress[member.id]) {
                        delete room.loadingProgress[member.id];
                    }

                    if (room.members.length === 0) {
                        activeRooms.delete(roomId);
                        console.log(`🗑️ Sala ${roomId} eliminada (vacía por desconexión)`);
                    } else {
                        io.to(roomId).emit('member-left', {
                            userId: member.id,
                            members: room.members
                        });

                        // Broadcast updated progress
                        if (room.loadingProgress) {
                            const progressValues = Object.values(room.loadingProgress);
                            const readyCount = progressValues.filter(p => p >= 50).length;
                            io.to(roomId).emit('loading-progress-updated', {
                                progress: room.loadingProgress,
                                readyCount: readyCount,
                                totalCount: room.members.length
                            });
                        }

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
