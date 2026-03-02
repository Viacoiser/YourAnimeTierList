import { create } from 'zustand';

/**
 * Store global de la aplicación usando Zustand
 */
const useStore = create((set, get) => ({
  // Estado de la sala
  roomId: null,
  roomName: null,
  roomMembers: [],
  currentUser: null,

  // Estado del reproductor
  playlist: [],
  currentVideoIndex: 0,
  isPlaying: false,
  remoteSeekTime: null, // Para sincronizar seeks
  timeSyncRequest: null, // Para pedir tiempo al host
  hostTime: null, // Para sincronización periódica (Drift correction)
  waitMode: false, // Modo Espera habilitado?
  usersReady: [], // Lista de usuarios listos (buffered)

  // Estado del ranking
  rankings: {}, // { videoId: { userId: tier } }
  finalRankings: [], // Resumen final de rankings

  // Socket.io reference
  socket: null,
  setSocket: (socket) => set({ socket }),

  // Acciones de sala
  createRoom: (userName, customRoomName, waitMode, authUserId = null) => {
    const socket = get().socket;
    // Generar ID único usando timestamp + random para evitar colisiones
    // Base 36 de timestamp (últimos 4 chars) + 2 chars random
    const timestamp = Date.now().toString(36).slice(-4);
    const random = Math.random().toString(36).substring(2, 4);
    const roomId = (timestamp + random).toUpperCase();

    console.log(`[CLIENT] createRoom called - ID: ${roomId}, User: ${userName}`);

    const user = {
      id: Math.random().toString(36).substring(2),
      name: userName,
      isHost: true,
      authUserId,  // Firebase UID or null for guest users
    };

    set({ currentUser: user, waitMode }); // Save locally too

    // Emitir evento de socket
    if (socket) {
      console.log(`[CLIENT] Emitting create-room event for ${roomId}`);
      socket.emit('create-room', {
        roomId,
        roomName: customRoomName || `Sala ${userName}`,
        userId: user.id,
        userName: user.name,
        authUserId,  // Send authUserId to server
        waitMode
      });
    }

    return roomId;
  },

  joinRoom: (roomId, userName, authUserId = null) => {
    const socket = get().socket;
    const user = {
      id: Math.random().toString(36).substring(2),
      name: userName,
      isHost: false,
      authUserId,  // Firebase UID or null for guest users
    };

    set({ currentUser: user });

    if (socket) {
      socket.emit('join-room', {
        roomId,
        userId: user.id,
        userName: user.name,
        authUserId  // Send authUserId to server
      });
    }
  },

  leaveRoom: () => {
    const socket = get().socket;
    const { roomId, currentUser } = get();

    if (socket && roomId && currentUser) {
      socket.emit('leave-room', { roomId, userId: currentUser.id });
    }

    set({
      roomId: null,
      roomName: null,
      roomMembers: [],
      currentUser: null,
      playlist: [],
      currentVideoIndex: 0,
      isPlaying: false,
      rankings: {},
      finalRankings: [],
    });
  },

  // Acciones del reproductor
  setPlaylist: (videos) => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('set-playlist', { roomId, playlist: videos });
    }
  },

  setPlaylist: (videos) => {
    console.log('Store: setPlaylist called', videos.length);
    const videosWithUuid = videos.map(v => ({ ...v, uuid: crypto.randomUUID() }));

    set({ playlist: videosWithUuid, currentVideoIndex: 0 });

    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('set-playlist', { roomId, playlist: videosWithUuid });
    }
  },

  addVideoToPlaylist: (video) => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('add-video', { roomId, video });
    }
  },

  addToPlaylist: (videos) => {
    set((state) => {
      const newVideos = videos.map(v => ({ ...v, uuid: crypto.randomUUID() }));
      return { playlist: [...state.playlist, ...newVideos] };
    });
  },

  playVideo: () => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('play-video', { roomId });
    }
  },

  pauseVideo: () => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('pause-video', { roomId });
    }
  },

  nextVideo: () => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('next-video', { roomId });
    }
  },

  previousVideo: () => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('previous-video', { roomId });
    }
  },

  goToVideo: (index) => {
    const socket = get().socket;
    const roomId = get().roomId;

    console.log('UseStore: goToVideo called', { index, roomId, socketId: socket?.id });

    if (socket && roomId) {
      socket.emit('go-to-video', { roomId, index });
      console.log('UseStore: Emitted go-to-video');
    } else {
      console.warn('UseStore: Cannot switch video - socket or roomId missing', { socket: !!socket, roomId });
    }
  },

  seekVideo: (currentTime) => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('seek-video', { roomId, currentTime });
    }
  },

  syncTimeResponse: (requesterId, currentTime) => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('sync-time-response', { roomId, requesterId, currentTime });
    }
  },

  sendTimeUpdate: (currentTime) => {
    const socket = get().socket;
    const roomId = get().roomId;

    if (socket && roomId) {
      socket.emit('time-update', { roomId, currentTime });
    }
  },

  getCurrentVideo: () => {
    const state = get();
    return state.playlist[state.currentVideoIndex] || null;
  },

  // Acciones de ranking
  rankVideo: (videoId, tier) => {
    const state = get();
    const userId = state.currentUser?.id;

    if (!userId) return;

    set((state) => ({
      rankings: {
        ...state.rankings,
        [videoId]: {
          ...state.rankings[videoId],
          [userId]: tier,
        },
      },
    }));
  },

  // Guardar ranking numérico (1-10)
  rankVideoNumeric: (videoId, score) => {
    const socket = get().socket;
    const { roomId, currentUser } = get();

    if (!currentUser) return;

    if (socket && roomId) {
      socket.emit('rank-video', {
        roomId,
        videoId,
        userId: currentUser.id,
        score
      });
    }
  },

  getUserRankingForVideo: (videoId) => {
    const state = get();
    const userId = state.currentUser?.id;

    if (!userId) return null;

    return state.rankings[videoId]?.[userId] || null;
  },

  getScoresForVideo: (videoId) => {
    const state = get();
    const map = state.rankings[videoId] || {};
    return Object.entries(map).map(([userId, score]) => ({ userId, score }));
  },

  getRankingsForVideo: (videoId) => {
    return get().rankings[videoId] || {};
  },

  // --- WAIT MODE ACTIONS ---
  sendUserReady: () => {
    const socket = get().socket;
    const roomId = get().roomId;
    const currentUser = get().currentUser;

    if (socket && roomId && currentUser) {
      const userId = currentUser.id || currentUser.uid;
      socket.emit('user-ready', { roomId, userId });
      console.log('Store: Sending user-ready signal');
    }
  },

  forceStart: () => {
    const socket = get().socket;
    const roomId = get().roomId;
    if (socket && roomId) {
      socket.emit('force-start', { roomId });
    }
  },

  updateRoomSettings: (settings) => {
    const socket = get().socket;
    const roomId = get().roomId;
    if (socket && roomId) {
      socket.emit('update-room-settings', { roomId, settings });
    }
  },

  // --- WAIT MODE V2 STATE & ACTIONS ---
  loadingProgress: {}, // { userId: percent }
  bufferingUsers: [], // [userId]

  sendVideoLoadProgress: (percent) => {
    const socket = get().socket;
    const roomId = get().roomId;
    const currentUser = get().currentUser;
    if (socket && roomId && currentUser) {
      socket.emit('video-load-progress', {
        roomId,
        userId: currentUser.id || currentUser.uid,
        percent
      });
    }
  },

  sendUserBuffering: (isBuffering) => {
    const socket = get().socket;
    const roomId = get().roomId;
    const currentUser = get().currentUser;
    if (socket && roomId && currentUser) {
      socket.emit('user-buffering', {
        roomId,
        userId: currentUser.id || currentUser.uid,
        isBuffering
      });
    }
  },

  // Called by socket listeners
  setLoadingProgress: (progress) => {
    set({ loadingProgress: progress });
  },

  setBufferingUser: (userId, isBuffering) => {
    set((state) => {
      const currentBuffering = state.bufferingUsers;
      if (isBuffering) {
        if (!currentBuffering.includes(userId)) return { bufferingUsers: [...currentBuffering, userId] };
      } else {
        return { bufferingUsers: currentBuffering.filter(id => id !== userId) };
      }
      return {};
    });
  },

  resetLoadingState: () => {
    set({ loadingProgress: {}, bufferingUsers: [] });
  },

  calculateFinalRankings: () => {
    const state = get();
    const { playlist, rankings } = state;

    const finalRankings = playlist.map(video => {
      const videoRankings = rankings[video.id] || {};
      const rankingValues = Object.values(videoRankings).map(v => typeof v === 'number' ? v : (
        // map letter tiers to numeric fallback if necessary
        { 'S': 10, 'A': 8, 'B': 7, 'C': 5, 'D': 3, 'F': 1 }[v] || 0
      ));

      const avgScore = rankingValues.length > 0
        ? rankingValues.reduce((sum, val) => sum + val, 0) / rankingValues.length
        : 0;

      return {
        video,
        rankings: videoRankings,
        averageScore: avgScore,
        totalVotes: rankingValues.length,
      };
    });

    // Ordenar por score promedio (descendente)
    finalRankings.sort((a, b) => b.averageScore - a.averageScore);

    set({ finalRankings });
  },
}));

export default useStore;
