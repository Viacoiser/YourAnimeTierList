import React, { useState } from 'react';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import { api } from '../services/api';
import toast from 'react-hot-toast';

function TierList({ video, onComplete }) {
  const [selectedScore, setSelectedScore] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const { rankVideoNumeric, getUserRankingForVideo, getScoresForVideo } = useStore();
  const { user: authUser } = useAuthStore();

  const existingRanking = getUserRankingForVideo(video.id);
  const allScores = getScoresForVideo(video.id);

  const handleScore = async (score) => {
    // Guardar localmente en Zustand (para la experiencia en la sala)
    rankVideoNumeric(video.id, score);
    setSelectedScore(score);

    // Guardar en la base de datos (para persistencia)
    if (authUser) {
      setIsSaving(true);
      try {
        const videoData = {
          animeName: video.animeName,
          themeName: video.themeName,
          themeType: video.themeType,
          songTitle: video.songTitle,
          artist: video.artist,
        };

        await api.saveRating(video.id, score, '', videoData);
        // No mostramos toast aquí para no saturar la UI
      } catch (error) {
        console.error('Error guardando puntuación:', error);
        toast.error('Error al guardar puntuación en el perfil');
      } finally {
        setIsSaving(false);
      }
    }

    setTimeout(() => onComplete(), 300);
  };

  return (
    <div
      className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 px-4"
      style={{ animation: 'fadeIn 0.15s ease-out' }}
    >
      <div
        className="glass-dark rounded-2xl p-8 max-w-2xl w-full mx-4"
        style={{ animation: 'scaleIn 0.2s ease-out' }}
      >
        <h2 className="text-3xl font-display font-bold text-center mb-6 text-gradient-red">
          Puntúa este video (1-10)
        </h2>

        <div className="text-center mb-8 p-6 bg-premium-black-400 rounded-xl">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h3 className="text-2xl font-semibold text-neutral-100">{video.animeName}</h3>
          </div>
          <p className="text-neutral-300 mb-1">{video.themeType} {video.themeName} - {video.songTitle}</p>
          <p className="text-neutral-500 text-sm">{video.artist}</p>
        </div>

        {existingRanking && (
          <div className="bg-yellow-600/20 border border-yellow-600/40 rounded-lg p-4 mb-6 text-center">
            <p className="text-neutral-200">Tu puntuación actual: <strong className="text-yellow-400 text-xl">{existingRanking}</strong></p>
          </div>
        )}

        <div className="grid grid-cols-5 gap-3 mb-8">
          {Array.from({ length: 10 }).map((_, i) => {
            const val = i + 1;
            return (
              <button
                key={val}
                className={`h-14 rounded-lg font-bold text-lg transition-all duration-200 ${selectedScore === val
                  ? 'bg-premium-red-600 text-white scale-110 shadow-glow-red'
                  : 'bg-premium-black-300 text-neutral-300 hover:bg-premium-red-700 hover:text-white hover:scale-105'
                  }`}
                onClick={() => handleScore(val)}
              >
                {val}
              </button>
            );
          })}
        </div>

        <div className="bg-premium-black-400 rounded-lg p-4 text-center">
          <h4 className="font-semibold text-neutral-200 mb-2">Votos ({allScores.length})</h4>
          <p className="text-neutral-400 mb-3">
            Promedio: <span className="text-premium-red-500 font-bold text-xl">
              {allScores.length > 0 ? (allScores.reduce((s, x) => s + (typeof x.score === 'number' ? x.score : 0), 0) / allScores.length).toFixed(2) : 'N/A'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {allScores.map(s => (
              <div key={s.userId} className="px-3 py-1 bg-premium-black-200 rounded-lg text-sm text-neutral-300">
                {s.score} ⭐
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TierList;
