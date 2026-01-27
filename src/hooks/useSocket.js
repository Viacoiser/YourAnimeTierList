import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3003';

export const useSocket = () => {
    const socketRef = useRef(null);
    const { user } = useAuthStore();

    useEffect(() => {
        // Crear conexión (tanto para usuarios autenticados como invitados)
        socketRef.current = io(SOCKET_URL, {
            auth: user ? {
                userId: user.id,
                username: user.displayName || user.username
            } : {}
        });

        const socket = socketRef.current;

        // ========== EVENTOS DE CONEXIÓN ==========
        socket.on('connect', () => {
            console.log('✅ Conectado a WebSocket');
        });

        socket.on('disconnect', () => {
            console.log('❌ Desconectado de WebSocket');
        });

        socket.on('error', (error) => {
            console.error('❌ Socket error:', error);
        });

        // ========== EVENTOS DE SALA ==========
        socket.on('room-created', ({ room }) => {
            console.log('🏠 Sala creada:', room.roomId);
            useStore.setState({
                roomId: room.roomId,
                roomName: room.roomName,
                roomMembers: room.members,
                playlist: room.playlist,
                currentVideoIndex: room.currentVideoIndex,
                isPlaying: room.isPlaying,
                waitMode: room.waitMode // Sync Wait Mode
            });
        });

        socket.on('room-joined', ({ room }) => {
            console.log('👤 Te uniste a sala:', room.roomId);
            useStore.setState({
                roomId: room.roomId,
                roomName: room.roomName,
                roomMembers: room.members,
                playlist: room.playlist,
                currentVideoIndex: room.currentVideoIndex,
                isPlaying: room.isPlaying,
                rankings: room.rankings,
                waitMode: room.waitMode // Sync Wait Mode
            });
        });

        socket.on('member-joined', ({ member, members }) => {
            console.log('👤 Nuevo miembro:', member.name);
            useStore.setState({ roomMembers: members });

            // Reproducir sonido de notificación
            try {
                const audio = new Audio('/src/assets/sounds/join.wav'); // Usar .wav
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Audio play failed (user interaction needed first):', e));
            } catch (e) {
                console.error('Error playing join sound:', e);
            }
        });

        socket.on('member-left', ({ userId, members }) => {
            console.log('👋 Miembro salió:', userId);
            useStore.setState({ roomMembers: members });
        });

        socket.on('new-host', ({ hostId, members }) => {
            console.log('👑 Nuevo host:', hostId);
            useStore.setState({ roomMembers: members });
        });

        // ========== EVENTOS DE PLAYLIST ==========
        socket.on('playlist-updated', ({ playlist }) => {
            console.log('📝 Playlist actualizada:', playlist.length, 'videos');
            useStore.setState({ playlist });
        });

        socket.on('video-playing', (data) => {
            console.log('▶️ Video reproduciéndose');
            useStore.setState({ isPlaying: data?.isPlaying ?? true });
        });

        socket.on('video-paused', (data) => {
            console.log('⏸️ Video pausado');
            useStore.setState({ isPlaying: data?.isPlaying ?? false });
        });

        socket.on('video-changed', ({ currentVideoIndex, isPlaying }) => {
            console.log('🎬 Video cambiado a índice:', currentVideoIndex);
            useStore.setState({
                currentVideoIndex,
                ...(isPlaying !== undefined && { isPlaying })
            });
        });

        socket.on('playlist-ended', () => {
            console.log('🏁 Playlist terminada');
            useStore.setState({ isPlaying: false });
            useStore.getState().calculateFinalRankings();
        });

        // ========== SINCRONIZACIÓN DE TIEMPO ==========
        socket.on('video-seeked', ({ currentTime }) => {
            console.log('⏩ Seek remoto recibido:', currentTime);
            useStore.setState({ remoteSeekTime: currentTime });
        });

        socket.on('get-current-time', ({ requesterId }) => {
            console.log('🕒 Solicitud de sincronización de tiempo de:', requesterId);
            useStore.setState({ timeSyncRequest: { requesterId } });
        });

        socket.on('time-update', ({ currentTime }) => {
            // No logueamos para no saturar consola
            useStore.setState({ hostTime: currentTime });
        });

        // ========== WAIT MODE & SETTINGS ==========
        socket.on('room-settings-updated', ({ settings }) => {
            console.log('⚙️ Configuración recibida:', settings);
            useStore.setState({
                waitMode: settings.waitMode,
                roomName: settings.name || settings.roomName
            });
        });

        socket.on('users-ready-updated', ({ usersReady }) => {
            console.log('✅ Usuarios listos:', usersReady);
            useStore.setState({ usersReady });
        });

        socket.on('force-start-video', () => {
            console.log('🚀 Inicio forzado recibido');
            useStore.setState({ isPlaying: true });
        });

        // ========== EVENTOS DE RANKINGS ==========
        socket.on('ranking-updated', ({ videoId, rankings }) => {
            console.log('⭐ Ranking actualizado para video:', videoId);
            useStore.setState((state) => ({
                rankings: {
                    ...state.rankings,
                    [videoId]: rankings
                }
            }));
        });

        // Cleanup al desmontar
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [user]);

    return socketRef.current;
};

// Funciones helper para emitir eventos (opcional, puedes usar socket.emit directamente)
export const socketEmit = {
    createRoom: (socket, { roomId, roomName, userId, userName }) => {
        socket?.emit('create-room', { roomId, roomName, userId, userName });
    },

    joinRoom: (socket, { roomId, userId, userName }) => {
        socket?.emit('join-room', { roomId, userId, userName });
    },

    leaveRoom: (socket, { roomId, userId }) => {
        socket?.emit('leave-room', { roomId, userId });
    },

    addVideo: (socket, { roomId, video }) => {
        socket?.emit('add-video', { roomId, video });
    },

    setPlaylist: (socket, { roomId, playlist }) => {
        socket?.emit('set-playlist', { roomId, playlist });
    },

    playVideo: (socket, { roomId }) => {
        socket?.emit('play-video', { roomId });
    },

    pauseVideo: (socket, { roomId }) => {
        socket?.emit('pause-video', { roomId });
    },

    nextVideo: (socket, { roomId }) => {
        socket?.emit('next-video', { roomId });
    },

    previousVideo: (socket, { roomId }) => {
        socket?.emit('previous-video', { roomId });
    },

    goToVideo: (socket, { roomId, index }) => {
        socket?.emit('go-to-video', { roomId, index });
    },

    rankVideo: (socket, { roomId, videoId, userId, score }) => {
        socket?.emit('rank-video', { roomId, videoId, userId, score });
    }
};
