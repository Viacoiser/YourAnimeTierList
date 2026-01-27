import React, { useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';

function VideoPlayer({ video, onVideoEnd, availableVersions = [], onSelectVersion }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const volumeRef = useRef(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(1);
  const [buffered, setBuffered] = useState(0);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);

  // Preloading State
  const [blobUrl, setBlobUrl] = useState(null); // Current video blob (if available)
  const preloadRef = useRef(null); // AbortController for preloading

  // Store hooks
  const {
    remoteSeekTime,
    timeSyncRequest,
    seekVideo,
    syncTimeResponse,
    currentUser,
    isPlaying: storeIsPlaying, // Renamed to avoid conflict
    playVideo,
    pauseVideo,
    playlist, // Need playlist to find next video
    currentVideoIndex,
    sendTimeUpdate, // New action
    hostTime, // New state
    roomMembers, // To check if host
    sendUserReady, // Fix: Add missing action
    waitMode // Check if wait mode active
  } = useStore();

  const isHost = roomMembers?.find(m => m.id === currentUser?.id)?.isHost || roomMembers?.find(m => m.id === currentUser?.uid)?.isHost;

  // Smart Source Selection: Prefer BlobURL if available -> else standard URL
  const currentSource = blobUrl || video.videoUrl;

  // Initialize Cache
  if (!window.__VIDEO_CACHE__) window.__VIDEO_CACHE__ = {};

  // Effect: Check if current video is cached
  useEffect(() => {
    if (window.__VIDEO_CACHE__[video.videoUrl]) {
      console.log('📦 Usando video desde caché local (Blob)');
      setBlobUrl(window.__VIDEO_CACHE__[video.videoUrl]);
    } else {
      setBlobUrl(null);
    }
  }, [video.videoUrl]);

  // Effect: Preload Next Video
  useEffect(() => {
    const preloadNextVideo = async () => {
      const nextIndex = currentVideoIndex + 1;
      if (nextIndex >= playlist.length) return;

      const nextVideo = playlist[nextIndex];
      const nextUrl = nextVideo.videoUrl;

      if (window.__VIDEO_CACHE__[nextUrl]) return; // Ya en caché

      console.log('⏳ Precargando siguiente video:', nextVideo.themeName);
      try {
        // Usar Proxy del Backend para evitar CORS
        // Asumimos localhost:3003 por ahora (igual que api.js)
        const proxyUrl = `http://localhost:3003/api/video-proxy?url=${encodeURIComponent(nextUrl)}`;

        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error('Proxy network response was not ok');

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        window.__VIDEO_CACHE__[nextUrl] = objectUrl;
        console.log('✅ Video precargado listo:', nextVideo.themeName);
      } catch (err) {
        console.warn('❌ Falló precarga:', err);
      }
    };

    // Pequeño delay para no saturar el inicio del video actual
    const t = setTimeout(preloadNextVideo, 3000);
    return () => clearTimeout(t);
  }, [currentVideoIndex, playlist]);


  // 1. Reaccionar a Seek Remoto
  useEffect(() => {
    if (remoteSeekTime !== null && videoRef.current) {
      // Solo aplicar si la diferencia es significativa (> 0.5s)
      const diff = Math.abs(videoRef.current.currentTime - remoteSeekTime);
      if (diff > 0.5) {
        videoRef.current.currentTime = remoteSeekTime;
        console.log('📍 Sincronizando tiempo a:', remoteSeekTime);
      }
      // IMPORTANTE: Limpiar el seek remoto una vez procesado
      useStore.setState({ remoteSeekTime: null });
    }
  }, [remoteSeekTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // console.log('🔄 Sync Play/Pause -> Store:', storeIsPlaying, 'VideoPaused:', video.paused);
      if (storeIsPlaying && video.paused) {
        video.play().catch(e => console.error('Play warning (handled):', e));
      } else if (!storeIsPlaying) {
        // Force pause regardless of current state to ensure sync
        video.pause();
      }
    }
  }, [storeIsPlaying]);

  // 2. Responder a solicitudes de sincronización (Solo si soy el host o tengo el dato)
  useEffect(() => {
    if (timeSyncRequest && videoRef.current) {
      // Respondemos INMEDIATAMENTE con el tiempo actual
      syncTimeResponse(timeSyncRequest.requesterId, videoRef.current.currentTime);

      // Limpiamos el request en el store para evitar loops o respuestas múltiples
      useStore.setState({ timeSyncRequest: null });
    }
  }, [timeSyncRequest]); // Removed syncTimeResponse from deps to avoid re-runs



  // ... (Cache logic remains)

  // ... (Preload logic remains)

  // ... (Remote Seek logic remains)

  // ... (Play/Pause logic remains)

  // ... (Sync Request Logic remains)

  // SYNC HEARTBEAT (Drift Correction)
  // 1. Host: Send time every 2s
  useEffect(() => {
    if (!isHost || !isVideoPlaying) return;

    const interval = setInterval(() => {
      if (videoRef.current) {
        sendTimeUpdate(videoRef.current.currentTime);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isHost, isVideoPlaying, sendTimeUpdate]);

  // 2. Guest: Check drift
  useEffect(() => {
    if (isHost || !hostTime || !videoRef.current || !isVideoPlaying) return;

    const diff = Math.abs(videoRef.current.currentTime - hostTime);
    // Si la diferencia es mayor a 3 segundos, corregimos
    if (diff > 3) {
      console.warn(`⚠️ Drift detectado (${diff.toFixed(2)}s). Sincronizando...`);
      videoRef.current.currentTime = hostTime;
    }
  }, [hostTime, isHost, isVideoPlaying]);


  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (!isDraggingVolume || !volumeRef.current) return;

      const rect = volumeRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const newVolume = Math.max(0, Math.min(1, x / rect.width));

      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        setIsMuted(newVolume === 0);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDraggingVolume(false);
    };

    if (isDraggingVolume) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      if (storeIsPlaying) {
        videoRef.current.play().catch(() => { });
      }
    }
  }, [currentSource]);

  // YouTube-style keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;

        case 'j':
          e.preventDefault();
          skip(-10);
          break;

        case 'l':
          e.preventDefault();
          skip(10);
          break;

        case 'arrowleft':
          e.preventDefault();
          skip(-5);
          break;

        case 'arrowright':
          e.preventDefault();
          skip(5);
          break;
        // ... rest of cases skipped for cleanliness of diff, assuming they don't involve seek logic changes other than via 'skip' function?
        // Wait, comma and period change currentTime directly.
        case ',':
          if (video.paused) {
            e.preventDefault();
            const newTime = Math.max(0, video.currentTime - 1 / 30);
            video.currentTime = newTime;
            seekVideo(newTime);
          }
          break;

        case '.':
          if (video.paused) {
            e.preventDefault();
            const newTime = Math.min(duration, video.currentTime + 1 / 30);
            video.currentTime = newTime;
            seekVideo(newTime);
          }
          break;

        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault();
          const percentage = parseInt(e.key) / 10;
          const newTime = duration * percentage;
          video.currentTime = newTime;
          seekVideo(newTime);
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [duration, isMuted, volume, previousVolume, seekVideo]); // Added seekVideo dependency

  // ... (handleTimeUpdate, handleProgress, etc remain same)

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      const videoDuration = videoRef.current.duration; // Shadow variable to avoid stale state
      if (videoDuration > 0) {
        setBuffered((bufferedEnd / videoDuration) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleCanPlay = () => {
    // Señal de "Listo" para Wait Mode
    if (!waitMode) {
      sendUserReady();
    }
  };

  const handleSeeked = () => {
    // Restaurar estado de reproducción si el store dice que debe estar tocando
    if (storeIsPlaying && videoRef.current?.paused) {
      console.log('🔄 onSeeked: Resuming playback per store state');
      videoRef.current.play().catch(() => { });
    }
  };

  const handlePlay = () => setIsVideoPlaying(true);
  const handlePause = () => setIsVideoPlaying(false);
  const handleEnded = () => {
    setIsVideoPlaying(false);
    onVideoEnd();
  };

  const togglePlayPause = () => {
    if (!isHost) return; // Solo Host puede pausar/play

    // NO hacer actualización optimista - dejar que el socket maneje la sincronización
    // Esto previene que el host se quede congelado
    if (videoRef.current) {
      if (videoRef.current.paused) {
        playVideo(); // Emitir al socket, el useEffect aplicará el cambio
      } else {
        pauseVideo(); // Emitir al socket, el useEffect aplicará el cambio
      }
    }
  };


  const skip = (seconds) => {
    if (!isHost) return; // Solo Host puede saltar

    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      seekVideo(newTime); // Emit seek

      // Si debería estar reproduciendo, forzar play usando onSeeked preferiblemente,
      // pero dejamos esto como backup inmediato
      if (storeIsPlaying) {
        videoRef.current.play().catch(() => { });
      }
    }
  };

  // ... rest of component ...

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error', err);
    }
  };

  const handleSeek = (e) => {
    if (!isHost) return; // Solo Host progesar

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;

    if (videoRef.current) {
      const newTime = percentage * duration;
      // NO hacer actualización optimista - dejar que el socket maneje la sincronización
      seekVideo(newTime); // El useEffect aplicará el cambio cuando reciba video-seeked
    }
  };

  const handleVolumeMouseDown = (e) => {
    setIsDraggingVolume(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, x / rect.width));

    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        // Unmuting - restore previous volume
        const volumeToRestore = previousVolume > 0 ? previousVolume : 0.5;
        setVolume(volumeToRestore);
        videoRef.current.volume = volumeToRestore;
        videoRef.current.muted = false;
        setIsMuted(false);
      } else {
        // Muting - save current volume
        setPreviousVolume(volume);
        setVolume(0);
        videoRef.current.volume = 0;
        videoRef.current.muted = true;
        setIsMuted(true);
      }
    }
  };

  const changeVolume = (delta) => {
    if (videoRef.current) {
      const newVolume = Math.max(0, Math.min(1, volume + delta));
      setVolume(newVolume);
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-dark rounded-xl overflow-hidden" ref={containerRef}>
      <div className="relative bg-black aspect-video flex justify-center items-center group">
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay} // Señal de Listo
          onSeeked={handleSeeked} // Check resume after seek
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          onClick={togglePlayPause}
          controls={false}
        >
          <source src={video.videoUrl} type="video/webm" />
          Tu navegador no soporta el elemento de video.
        </video>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 px-4 py-3 bg-gradient-to-t from-black/95 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            className="text-white hover:text-premium-red-500 transition-all transform hover:scale-110 drop-shadow-md"
            onClick={togglePlayPause}
          >
            {isVideoPlaying ? (
              <svg className="w-8 h-8 md:w-10 md:h-10 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 md:w-10 md:h-10 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>



          <span className="text-sm font-mono text-neutral-200 whitespace-nowrap ml-2 drop-shadow-sm font-medium">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Progress Bar (YouTube Style) */}
          <div
            className="flex-1 h-3 mx-4 cursor-pointer relative group/bar flex items-center"
            onClick={handleSeek}
          >
            {/* Track bg */}
            <div className="absolute w-full h-[3px] bg-white/20 group-hover/bar:h-[5px] transition-all duration-200"></div>

            {/* Buffer */}
            <div
              className="absolute h-[3px] bg-white/40 group-hover/bar:h-[5px] transition-all duration-200"
              style={{ width: `${buffered}%` }}
            ></div>

            {/* Progress */}
            <div
              className="absolute h-[3px] group-hover/bar:h-[5px] bg-premium-red-600 transition-all duration-200"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-premium-red-600 rounded-full scale-0 group-hover/bar:scale-100 transition-transform duration-100" />
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2 group/vol relative">
            <button
              className="text-white hover:text-premium-red-500 transition-colors drop-shadow-md"
              onClick={toggleMute}
              title={isMuted ? 'Activar sonido' : 'Silenciar'}
            >
              {isMuted || volume === 0 ? (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              ) : volume < 0.5 ? (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" /></svg>
              ) : (
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              )}
            </button>
            {/* Custom Volume Slider */}
            <div
              ref={volumeRef}
              className="w-0 overflow-hidden group-hover/vol:w-28 transition-all duration-300 h-8 flex items-center cursor-pointer ml-0 px-2"
              onMouseDown={handleVolumeMouseDown}
            >
              <div className="w-full h-1 bg-white/20 rounded-full relative">
                {/* Volume Fill */}
                <div
                  className="absolute h-full bg-premium-red-600 rounded-full"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
                {/* Volume Knob */}
                <div
                  className="absolute h-3 w-3 bg-white rounded-full top-1/2 shadow-sm"
                  style={{ left: `${(isMuted ? 0 : volume) * 100}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>
            </div>
          </div>

          <button
            className="text-white hover:text-premium-red-500 hover:scale-110 transition-transform ml-2 drop-shadow-md"
            onClick={toggleFullscreen}
            title="Pantalla completa"
          >
            <svg className="w-7 h-7 fill-current" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoPlayer;
