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
  createRoom: (userName, customRoomName, waitMode) => {
    const socket = get().socket;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const user = {
      id: Math.random().toString(36).substring(2),
      name: userName,
      isHost: true,
    };

    set({ currentUser: user, waitMode }); // Save locally too

    // Emitir evento de socket
    if (socket) {
      socket.emit('create-room', {
        roomId,
        roomName: customRoomName || `Sala ${userName}`,
        userId: user.id,
        userName: user.name,
        waitMode
      });
    }

    return roomId;
  },

  joinRoom: (roomId, userName) => {
    const socket = get().socket;
    const user = {
      id: Math.random().toString(36).substring(2),
      name: userName,
      isHost: false,
    };

    set({ currentUser: user });

    if (socket) {
      socket.emit('join-room', {
        roomId,
        userId: user.id,
        userName: user.name
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
