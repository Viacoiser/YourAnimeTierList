import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import { useSocket } from '../hooks/useSocket';
// import { addFavorite, removeFavorite, isFavorite } from '../services/database'; // DEPRECATED
import { api } from '../services/api';
import toast from 'react-hot-toast';
import animeApi from '../services/animeApi';
import VideoPlayer from './VideoPlayer';
import TierList from './TierList';
import SearchBar from './SearchBar';
import WelcomeScreen from './WelcomeScreen';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  // Socket.io connection
  const socket = useSocket();
  const { setSocket } = useStore();

  const {
    currentUser: roomUser, // Renombramos el usuario de la sala para evitar conflicto
    roomMembers,
    roomName: storeRoomName,
    playlist,
    currentVideoIndex,
    isPlaying,
    setPlaylist,
    addToPlaylist,
    nextVideo,
    goToVideo,
    leaveRoom,
    getCurrentVideo,
    finalRankings,
    getScoresForVideo, // Aseguramos traer esto
  } = useStore();

  const { user: authUser } = useAuthStore(); // Usuario autenticado real
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showFinalResults, setShowFinalResults] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(true);

  // Inyectar socket en el store
  // Inyectar socket en el store y conectar a la sala
  useEffect(() => {
    if (socket) {
      setSocket(socket);
      console.log('✅ Socket inyectado en el store');

      // Asegurar que nos unimos/creamos la sala en el backend
      if (roomUser && roomId) {
        if (roomUser.isHost) {
          console.log('📤 Emitiendo create-room desde Room.jsx');
          socket.emit('create-room', {
            roomId,
            roomName: storeRoomName || `Sala ${roomUser.name}`,
            userId: roomUser.id,
            userName: roomUser.name
          });
        } else {
          console.log('📤 Emitiendo join-room desde Room.jsx');
          socket.emit('join-room', {
            roomId,
            userId: roomUser.id,
            userName: roomUser.name
          });
        }
      }
    }
  }, [socket, setSocket, roomId, roomUser, storeRoomName]);

  useEffect(() => {
    if (!roomUser) {
      toast.error('Debes unirte a una sala primero');
      navigate('/');
      return;
    }

    if (playlist.length === 0) {
      // Solo el host debe generar la playlist inicial
      if (roomUser?.isHost) {
        loadPlaylist();
      } else {
        // Invitados esperan la playlist del socket
        // No hacemos nada, loading sigue true hasta que llegue el evento del socket
      }
    } else {
      setLoading(false);
      console.log('📦 Playlist cargada en Room UI:', playlist.length);
    }
  }, [roomUser, navigate, playlist.length]);

  // Failsafe independiente: Forzar fin de carga después de 5s máximo
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Failsafe activado: forzando fin de carga');
      setLoading(false);
    }, 5000);

    return () => clearTimeout(safetyTimeout);
  }, []);

  // Failsafe para WelcomeScreen: Si ya cargó, forzar cierre después de la animación
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => {
        console.log('📺 Forzando cierre de WelcomeScreen desde Room');
        setShowWelcome(false);
      }, 3500); // 2.5s (minTime) + 0.7s (animación) + margen
      return () => clearTimeout(t);
    }
  }, [loading]);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      setError(null);

      const videos = await animeApi.getRandomAnimeThemes(15);

      if (videos.length === 0) {
        throw new Error('La API devolvió 0 videos. Verifica la conexión con el servidor backend.');
      }

      setPlaylist(videos);
      toast.success(`${videos.length} videos cargados!`);
    } catch (err) {
      console.error(err);
      setError(err.message);
      toast.error('Error al cargar la playlist');
    } finally {
      setLoading(false);
    }
  };

  // Estado para saber si la votación fue manual
  const [isManualRating, setIsManualRating] = useState(false);

  const handleVideoEnd = () => {
    setIsManualRating(false); // Es automático por fin de video
    setShowRanking(true);
  };

  const handleRankingComplete = () => {
    setShowRanking(false);

    // Si fue votación manual, NO pasamos al siguiente video
    if (isManualRating) {
      showMinimalToast('¡Puntuación guardada!');
      setIsManualRating(false); // Reset
      return;
    }

    if (currentVideoIndex >= playlist.length - 1) {
      setShowFinalResults(true);
    } else {
      nextVideo();
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate('/');
  };

  const handleNewPlaylist = async () => {
    setShowFinalResults(false);
    await loadPlaylist();
  };

  const handleAddVideosFromSearch = (videos, playNow = false) => {
    if (videos.length > 0) {
      // Si playNow es true, queremos reproducir el primer video de los agregados
      const newIndex = playlist.length; // El índice será el final actual

      addToPlaylist(videos);

      if (playNow) {
        setShowSearch(false);
        // Pequeño timeout para permitir que el estado se actualice
        setTimeout(() => {
          goToVideo(newIndex);
          showMinimalToast(`Reproduciendo: ${videos[0].themeName}`);
        }, 50);
      }
    }
  };

  const currentVideo = getCurrentVideo();

  const versions = useMemo(() => {
    if (!currentVideo) return [];
    return playlist
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.animeId === currentVideo.animeId && v.themeName === currentVideo.themeName)
      .map(({ v, i }) => ({
        index: i,
        id: v.id,
        version: `${v.themeType || ''}${v.themeSequence || ''}`.trim() || v.version || 'Ver',
        resolution: v.resolution || v.quality || '',
      }));
  }, [playlist, currentVideo]);

  const [showCode, setShowCode] = useState(false);
  const host = roomMembers.find(m => m.isHost) || roomMembers[0];
  const roomName = storeRoomName || (host ? `Sala ${host.name}` : 'Sala de Anime');

  const showMinimalToast = (message) => {
    toast(message, {
      duration: 1400,
      position: 'bottom-center',
      style: {
        background: 'rgba(10,10,10,0.9)',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '12px',
        fontSize: '0.95rem',
        border: '1px solid rgba(220, 38, 38, 0.3)',
      },
    });
  };

  if (showFinalResults) {
    return (
      <div className="min-h-screen p-6">
        <div className="glass-dark rounded-xl p-4 mb-6 max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-2xl font-display font-bold text-gradient-red">🏆 Resultados Finales</h2>
              <span className="text-neutral-400">Sala: <span className="text-premium-red-500 font-semibold">{roomId}</span></span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto glass-dark rounded-2xl p-8">
          <h3 className="text-3xl font-display font-bold text-center mb-8 text-gradient-red">Tier List Final</h3>
          <div className="space-y-4 mb-8">
            {finalRankings.map((item, index) => (
              <div key={item.video.id} className="card-premium flex items-center gap-6 hover:scale-[1.02] transition-transform">
                <div className="text-4xl font-bold text-premium-red-600 min-w-[60px] text-center">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-neutral-100 mb-1">{item.video.animeName}</h4>
                  <p className="text-neutral-400">{item.video.themeName} - {item.video.songTitle}</p>
                  <p className="text-neutral-500 text-sm">{item.video.artist}</p>
                </div>
                <div className="text-center min-w-[80px]">
                  <div className="text-3xl font-bold text-premium-red-500">
                    {item.averageScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-neutral-500">
                    {item.totalVotes} votos
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 justify-center">
            <button className="btn-premium px-8" onClick={handleNewPlaylist}>
              Nueva Playlist
            </button>
            <button className="btn-secondary px-8" onClick={handleLeaveRoom}>
              Salir de la Sala
            </button>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-transparent p-4 md:p-8 flex flex-col font-sans text-neutral-100 relative">
      <div className="absolute inset-0 bg-dotted-pattern opacity-20 pointer-events-none"></div>

      {/* Pantalla de Bienvenida (Overlay) */}
      {showWelcome && (
        <WelcomeScreen
          username={roomUser?.name || authUser?.displayName}
          isLoading={loading}
          onFinished={() => setShowWelcome(false)}
        />
      )}

      {/* Floating Profile Button - Bottom Right */}
      {!showWelcome && authUser && (
        <button
          onClick={() => navigate('/profile')}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 glass-dark px-4 py-3 rounded-2xl border border-yellow-500/30 hover:border-yellow-500 shadow-2xl bg-black/80 backdrop-blur-md transition-all duration-300 hover:scale-105 animate-fade-in-up group"
          title="Ver Mi Perfil"
        >
          <div className="flex items-center gap-3">
            <img
              src={authUser.avatar || authUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authUser.displayName || authUser.username)}&background=dc2626&color=fff`}
              alt={authUser.displayName || authUser.username}
              className="w-10 h-10 rounded-full border-2 border-yellow-500 group-hover:border-yellow-400 transition-colors"
            />
            <div className="flex flex-col">
              <span className="text-neutral-200 font-bold text-sm leading-tight">
                {authUser.displayName || authUser.username}
              </span>
              <span className="text-yellow-400 text-xs font-medium">
                Mi Perfil
              </span>
            </div>
          </div>
        </button>
      )}

      {/* Contenido Principal */}
      {!showWelcome && (
        <>
          {/* Header */}
          <div className="glass-dark rounded-xl px-4 py-3 mb-5 max-w-[1900px]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleLeaveRoom}
                  className="p-2 bg-premium-red-600/10 text-premium-red-500 rounded-xl hover:bg-premium-red-600 hover:text-white transition-all duration-300 hover:scale-105"
                  title="Ir al Inicio"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </button>
                <div className="flex items-center gap-6">
                  <h2 className="text-xl md:text-2xl font-display font-bold text-neutral-100">{roomName}</h2>
                  <span className="text-neutral-400 flex items-center gap-2">
                    Código:
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="px-2 py-0.5 bg-premium-black-400 rounded cursor-pointer hover:bg-premium-black-300 transition-colors text-premium-red-500 font-semibold min-w-[80px]"
                      title={showCode ? "Ocultar código" : "Mostrar código"}
                    >
                      {showCode ? roomId : '••••••'}
                    </button>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 md:mr-4">
                <button
                  className="px-4 py-2 bg-premium-red-600 text-white rounded-lg hover:bg-premium-red-700 transition-colors font-semibold"
                  onClick={() => setShowSearch(true)}
                >
                  🔍 Buscar
                </button>

                <button
                  className="px-4 py-2 bg-premium-black-200 text-neutral-100 rounded-lg hover:bg-premium-black-100 transition-colors font-semibold"
                  onClick={handleLeaveRoom}
                >
                  Salir
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col xl:flex-row gap-3 max-w-[98%] 2xl:max-w-[2400px] mb-10">
            {/* Video Section */}
            <div className="space-y-4 xl:w-[1500px]">
              {currentVideo && (
                <>
                  <VideoPlayer
                    video={currentVideo}
                    onVideoEnd={handleVideoEnd}
                    availableVersions={versions}
                    onSelectVersion={(idx) => {
                      goToVideo(idx);
                      showMinimalToast('Cambiando versión…');
                    }}
                  />

                  <div className="glass-dark rounded-xl p-4">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">

                      {/* Left Side: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="mb-2">
                          <h3 className="text-xl md:text-2xl font-display font-bold text-gradient-red truncate" title={currentVideo.animeName}>
                            {currentVideo.animeName}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-300">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-premium-red-600/20 text-premium-red-400 border border-premium-red-600/30 rounded text-xs font-bold uppercase tracking-wider">
                              {currentVideo.themeType}
                            </span>
                            <span className="text-neutral-400">
                              {currentVideo.themeName}
                            </span>
                            <span className="text-neutral-500">
                              ({currentVideo.animeYear})
                            </span>
                          </div>

                          <span className="hidden sm:inline text-neutral-600">|</span>

                          <p className="truncate flex items-center gap-1">
                            <strong className="text-white">{currentVideo.songTitle}</strong> <span className="text-neutral-500">-</span> {currentVideo.artist}
                          </p>

                          <div className="hidden sm:flex gap-3 text-xs text-neutral-500 border-l border-white/10 pl-3 ml-auto sm:ml-0">
                            <span>{currentVideo.resolution || 'HD'}</span>
                            <span>{currentVideo.source || 'BD'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Side: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={async () => {
                            const uid = authUser?.id || authUser?.uid;
                            if (!uid) return toast.error('Inicia sesión para guardar favoritos');
                            try {
                              const isFav = await api.checkFavorite(currentVideo.id);
                              if (isFav) {
                                await api.removeFavorite(currentVideo.id);
                                toast.success('Removido de favoritos');
                              } else {
                                await api.addFavorite(currentVideo.id, currentVideo);
                                toast.success('Agregado a favoritos ⭐');
                              }
                            } catch (error) {
                              console.error(error);
                              toast.error(error.message || 'Error al actualizar favorito');
                            }
                          }}
                          className="p-1.5 bg-premium-black-300 hover:bg-premium-black-200 text-yellow-400 rounded-lg border border-yellow-500/10 hover:border-yellow-500/30 transition-all hover:scale-105"
                          title="Favorito"
                        >
                          <span className="text-lg">⭐</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsManualRating(true);
                            setShowRanking(true);
                          }}
                          className="flex items-center gap-2 px-4 py-3 bg-premium-red-600 hover:bg-premium-red-700 text-white rounded-xl transition-all hover:scale-105 shadow-glow-red font-bold"
                          title="Votar"
                        >
                          <span className="text-xs uppercase tracking-wider opacity-80">Votar</span>
                        </button>
                      </div>

                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Users Section */}
            <div className="glass-dark rounded-xl p-3 h-fit xl:w-[300px]">
              <h3 className="text-xl font-display font-semibold mb-4 text-gradient-red">
                Usuarios ({roomMembers.length})
              </h3>
              <div className="space-y-3">
                {roomMembers.map((m) => {
                  // Buscar puntuación de este usuario para el video actual
                  // Nota: currentVideo puede ser null al inicio, validar
                  const userScore = currentVideo ? getScoresForVideo(currentVideo.id).find(s => s.userId === m.id || s.userName === m.name)?.score : null;

                  return (
                    <div key={m.id} className="flex items-center gap-3 p-3 bg-premium-black-400 rounded-lg justify-between group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-10 h-10 rounded-full bg-premium-red-600 text-white flex items-center justify-center font-bold text-lg border-2 border-transparent group-hover:border-white transition-colors">
                          {m.name ? m.name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-neutral-100 truncate w-24 text-sm">{m.name}</div>
                          {m.isHost && (
                            <div className="text-[10px] bg-premium-red-600/20 text-premium-red-400 px-1.5 py-0.5 rounded inline-block">
                              Host
                            </div>
                          )}
                        </div>
                      </div>

                      {userScore && (
                        <div className="flex flex-col items-center min-w-[40px]">
                          <span className="text-2xl font-bold text-yellow-400 drop-shadow-sm">{userScore}</span>
                          <span className="text-[10px] text-neutral-400 uppercase">Nota</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Playlist Section */}
            <div className="glass-dark rounded-xl p-4 h-fit xl:w-[300px]">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xl font-display font-semibold text-gradient-red">
                  Playlist ({currentVideoIndex + 1}/{playlist.length})
                </h3>
                <button
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className="p-2 bg-premium-black-300 hover:bg-premium-black-200 text-neutral-300 hover:text-white rounded-lg transition-all"
                  title={showPlaylist ? "Ocultar playlist" : "Mostrar playlist"}
                >
                  {showPlaylist ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              </div>

              <div className={`space-y-2 pr-2 transition-all duration-500 ease-in-out ${showPlaylist ? 'max-h-[600px] opacity-100 overflow-y-auto' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                {playlist.map((video, index) => (
                  <div
                    key={video.uuid || `${video.id}-${index}`}
                    className={`p-3 rounded-lg cursor-pointer transition-all duration-200 flex items-center gap-4 ${index === currentVideoIndex
                      ? 'bg-premium-red-600 text-white shadow-premium'
                      : index < currentVideoIndex
                        ? 'bg-premium-black-400 opacity-60 hover:opacity-80'
                        : 'bg-premium-black-300 hover:bg-premium-black-200 hover:border-premium-red-800 border border-transparent'
                      }`}
                    onClick={() => goToVideo(index)}
                    title="Click para reproducir"
                  >
                    <div className={`text-xl font-display font-bold w-8 shrink-0 text-center ${index === currentVideoIndex ? 'text-white' : 'text-neutral-500'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className={`font-bold text-sm truncate leading-tight ${index === currentVideoIndex ? 'text-white' : 'text-neutral-200'}`}>
                        {video.animeName}
                      </div>
                      <div className={`text-xs truncate mt-0.5 font-medium ${index === currentVideoIndex ? 'text-premium-red-100' : 'text-neutral-500'}`}>
                        {video.themeType} {video.themeName}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showRanking && currentVideo && (
            <TierList
              video={currentVideo}
              onComplete={handleRankingComplete}
            />
          )}

          {showSearch && (
            <SearchBar
              onSelectVideos={handleAddVideosFromSearch}
              onClose={() => setShowSearch(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default Room;
