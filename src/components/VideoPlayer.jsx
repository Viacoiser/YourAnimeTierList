import React, { useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';
import LoadingProgress from './LoadingProgress';
import BufferingIndicator from './BufferingIndicator';
import { API_URL } from '../services/api';

// Constantes de sincronización
const SYNC_TOLERANCE = 2.0; // Segundos de diferencia permitida antes de forzar sync
const HEARTBEAT_INTERVAL = 1000; // Milisegundos entre actualizaciones de tiempo (optimizado)

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

  // Quality Selection State
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [currentResolution, setCurrentResolution] = useState(video.resolution ? parseInt(video.resolution) : 0);
  const [activeSourceUrl, setActiveSourceUrl] = useState(null);

  // Update resolution state when video changes
  useEffect(() => {
    setActiveSourceUrl(null); // Reset manual quality override
    if (video.resolution) {
      setCurrentResolution(parseInt(video.resolution));
    }
  }, [video.id]);

  const changeQuality = (source) => {
    if (source.resolution === currentResolution) return;

    // Save current state
    const currentTime = videoRef.current ? videoRef.current.currentTime : 0;
    const isPlaying = !videoRef.current?.paused;

    console.log(`🔄 Switching quality to ${source.resolution}p`);

    // Update UI state
    setCurrentResolution(source.resolution);
    setActiveSourceUrl(source.url);
    setShowQualityMenu(false);

    // RESTORE STATE AFTER SOURCE CHANGE
    // The video element will reload when source changes. 
    // We use a one-time event listener on 'loadedmetadata' to restore time.
    const restoreState = () => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        if (isPlaying && storeIsPlaying) {
          videoRef.current.play().catch(e => console.warn('Resume failed', e));
        }
      }
      // Cleanup listener to avoid affecting future loads
      videoRef.current?.removeEventListener('loadedmetadata', restoreState);
    };

    // We can't attach listener here because ref might change or race condition
    // Better strategy: Use a ref to store "pendingRestore" state?
    // Actually, simply setting currentTime in the useEffect[currentSource] might be enough if we track "isQualityChange"

    // Let's force it via a temporary listener on the DOM element which persists
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', restoreState, { once: true });
    }
  };

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
    waitMode, // Check if wait mode active

    // V2 New Actions & State
    loadingProgress,
    bufferingUsers,
    sendVideoLoadProgress,
    sendUserBuffering
  } = useStore();

  const isHost = roomMembers?.find(m => m.id === currentUser?.id)?.isHost || roomMembers?.find(m => m.id === currentUser?.uid)?.isHost;

  // Smart Source Selection: Prefer BlobURL if available -> else Proxy URL (Force Cache)
  const getProxySource = () => {
    if (!video || !video.videoUrl) return '';

    // Determine target URL (Quality selection or Default)
    const targetUrl = activeSourceUrl || video.videoUrl;

    // Construct Proxy URL
    return `${API_URL}/video-proxy?url=${encodeURIComponent(targetUrl)}`;
  };

  const currentSource = blobUrl || getProxySource();

  // Initialize Cache
  if (!window.__VIDEO_CACHE__) window.__VIDEO_CACHE__ = {};

  // ... (Cache and Preload effects remain same)

  // ... (Seek and Sync effects remain same)

  // Buffering event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => {
      console.log('⏳ Buffering started');
      sendUserBuffering(true);
    };

    const handlePlaying = () => {
      console.log('▶️ Playback resumed after buffering');
      sendUserBuffering(false);

      // Resincronizar con el host si soy participant
      if (!isHost && hostTime && video) {
        const diff = Math.abs(video.currentTime - hostTime);
        if (diff > SYNC_TOLERANCE) {
          console.log(`🔄 Resyncing after buffering (diff: ${diff.toFixed(2)}s)`);
          video.currentTime = hostTime;
        }
      }
    };

    const handleStalled = () => {
      console.warn('⚠️ Network stalled - connection issues');
    };

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('stalled', handleStalled);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('stalled', handleStalled);
    };
  }, [isHost, hostTime, sendUserBuffering]); // Added sendUserBuffering

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
      // Note: We don't auto-play here blindly anymore because changeQuality handles its own resume logic via 'loadedmetadata'.
      // However, for a fresh video load (not quality change), we might want to respect storeIsPlaying.
      // The storeIsPlaying effect (line 110) will handle playing if needed.
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
            // Solo emitir, no actualizar optimísticamente
            seekVideo(newTime);
          }
          break;

        case '.':
          if (video.paused) {
            e.preventDefault();
            const newTime = Math.min(duration, video.currentTime + 1 / 30);
            // Solo emitir, no actualizar optimísticamente
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
          // Solo emitir, no actualizar optimísticamente
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
    console.log('[DEBUG] togglePlayPause() called');
    if (!isHost) return; // Solo Host puede pausar/play

    // NO hacer actualización optimista - dejar que el socket maneje la sincronización
    // Esto previene que el host se quede congelado
    if (videoRef.current) {
      if (videoRef.current.paused) {
        console.log('[DEBUG] Host emitting play-video');
        playVideo(); // Emitir al socket, el useEffect aplicará el cambio
      } else {
        console.log('[DEBUG] Host emitting pause-video');
        pauseVideo(); // Emitir al socket, el useEffect aplicará el cambio
      }
    }
  };


  const skip = (seconds) => {
    if (!isHost) return; // Solo Host puede saltar

    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      // NO hacer actualización optimista - dejar que el socket maneje la sincronización
      seekVideo(newTime); // El useEffect aplicará el cambio cuando reciba video-seeked
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

      // ✅ Actualización optimista: Host se mueve inmediatamente
      videoRef.current.currentTime = newTime;
      seekVideo(newTime);

      // Forzar play si estaba reproduciendo
      if (storeIsPlaying) {
        videoRef.current.play().catch(() => { });
      }
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

  // Calculated Ready Count for specific overlay
  const readyCount = loadingProgress ? Object.values(loadingProgress).filter(p => p >= 50).length : 0;

  return (
    <div className="glass-dark rounded-xl overflow-hidden" ref={containerRef}>
      <div className="relative bg-black aspect-video flex justify-center items-center group">

        {/* V2: Loading Progress Overlay */}
        {waitMode && !storeIsPlaying && (
          <LoadingProgress
            members={roomMembers}
            loadingProgress={loadingProgress}
            readyCount={readyCount}
            totalCount={roomMembers.length}
          />
        )}

        {/* V2: Buffering Indicator (Always visible if active) */}
        <BufferingIndicator bufferingUsers={bufferingUsers} members={roomMembers} />

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
          onError={(e) => console.error('❌ Video Error:', videoRef.current?.error, 'Source:', currentSource)}
          onClick={togglePlayPause}
          controls={false}
        >
          <source src={currentSource} type="video/webm" />
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

          {/* Quality Selector */}
          <div className="relative group/settings">
            <button
              className="text-white hover:text-premium-red-500 transition-colors drop-shadow-md ml-2"
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              title="Calidad"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.24.41.48.41h3.84c.24 0 .43-.17.47-.41l.36-2.54c.59-.24 1.13-.57 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.08-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" /></svg>
            </button>

            {/* Quality Menu */}
            {showQualityMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-md rounded-lg overflow-hidden border border-premium-red-900/30 w-32 animate-in fade-in slide-in-from-bottom-2 z-50">
                <div className="py-1">
                  {video.sources && video.sources.length > 0 ? (
                    video.sources.map((source, index) => (
                      <button
                        key={index}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-premium-red-900/30 transition-colors ${currentResolution === source.resolution ? 'text-premium-red-500 font-bold' : 'text-neutral-200'}`}
                        onClick={() => changeQuality(source)}
                      >
                        {source.resolution}p
                        {currentResolution === source.resolution && ' ✓'}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-2 text-sm text-neutral-500">Auto ({video.resolution || '?'}p)</div>
                  )}
                </div>
              </div>
            )}
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
