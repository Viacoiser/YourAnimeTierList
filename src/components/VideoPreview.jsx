import React, { useState, useRef } from 'react';

function VideoPreview({ video, onAdd, onPlayNow }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
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
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  return (
    <div className="bg-premium-black-400 rounded-lg overflow-hidden border border-premium-black-200 hover:border-premium-red-600/50 hover:shadow-glow-red transition-all group">
      {/* Header Info */}
      <div className="p-3 flex items-start justify-between gap-3 bg-premium-black-300/50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-bold rounded ${video.themeType === 'OP' ? 'bg-premium-red-600 text-white' : 'bg-blue-600 text-white'
              }`}>
              {video.themeType}{video.themeSequence || ''}
            </span>
            <span className="text-sm font-medium text-neutral-100 truncate">{video.themeName}</span>
          </div>
          <div className="text-lg font-bold text-white leading-tight truncate">{video.songTitle}</div>
          <div className="text-sm text-neutral-400 truncate">{video.artist}</div>
        </div>
      </div>

      {/* Video Container - Fixed Aspect Ratio 16:9 */}
      <div className="relative w-full aspect-video bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          loop
          muted={isMuted}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        >
          <source src={video.videoUrl} type="video/webm" />
        </video>

        {/* Play Overlay (Big Center Button) */}
        <div className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
          <button
            className="w-16 h-16 bg-white/10 backdrop-blur-sm border-2 border-white/50 rounded-full flex items-center justify-center text-3xl hover:bg-premium-red-600 hover:border-premium-red-600 hover:scale-110 transition-all text-white"
            onClick={handlePlayPause}
          >
            {isPlaying ? '⏸️' : '▶️'}
          </button>
        </div>

        {/* Volume Controls (Bottom Overlay) */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full px-3 py-1 backdrop-blur-md">
          <button onClick={toggleMute} className="text-white hover:text-premium-red-400">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Action Buttons Footer */}
      <div className="p-3 grid grid-cols-2 gap-3 bg-premium-black-300/30">
        <button
          className="btn-secondary py-2 flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-colors"
          onClick={() => onAdd(video)}
        >
          <span>➕</span> Agregar
        </button>
        <button
          className="btn-premium py-2 flex items-center justify-center gap-2 hover:scale-[1.02] shadow-lg"
          onClick={() => onPlayNow && onPlayNow(video)}
        >
          <span>▶️</span> Ver Ahora
        </button>
      </div>
    </div>
  );
}

export default VideoPreview;
