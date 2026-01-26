import React, { useState, useEffect, useRef } from 'react';
import animeApi from '../services/animeApi';
import toast from 'react-hot-toast';
import VideoPreview from './VideoPreview';

function SearchBar({ onSelectVideos, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAutocomplete, setLoadingAutocomplete] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const searchTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const ignoreNextSearch = useRef(false);

  useEffect(() => {
    // Si la actualización viene de una selección, ignorar la búsqueda
    if (ignoreNextSearch.current) {
      ignoreNextSearch.current = false;
      return;
    }

    if (searchTerm.length >= 4) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      setLoadingAutocomplete(true);
      setShowAutocomplete(true);

      // Debounce de 300ms para no saturar la API
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const results = await animeApi.searchAnimeAutocomplete(searchTerm);
          setAutocompleteResults(results);
          setLoadingAutocomplete(false);
        } catch (error) {
          setAutocompleteResults([]);
          setLoadingAutocomplete(false);
        }
      }, 300);
    } else {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
      setLoadingAutocomplete(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const handleSearch = async (query = searchTerm) => {
    if (!query.trim()) {
      toast.error('Por favor ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    // Forzar cierre de autocompletado y limpiar resultados para evitar que reaparezca
    setShowAutocomplete(false);
    setAutocompleteResults([]);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    try {
      const results = await animeApi.searchAnime(query);

      if (results.length === 0) {
        toast.error('No se encontraron resultados');
        setSearchResults([]);
        return;
      }

      const groupedByAnime = results.reduce((acc, video) => {
        if (!acc[video.animeId]) {
          acc[video.animeId] = {
            animeId: video.animeId,
            animeName: video.animeName,
            animeYear: video.animeYear,
            thumbnailUrl: video.thumbnailUrl,
            videos: [],
          };
        }
        acc[video.animeId].videos.push(video);
        return acc;
      }, {});

      const grouped = Object.values(groupedByAnime);
      setSearchResults(grouped);
      toast.success(`${grouped.length} anime encontrado${grouped.length !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Error al buscar anime. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleAutocompleteSelect = async (anime) => {
    ignoreNextSearch.current = true; // Evitar que el useEffect dispare una nueva búsqueda
    setSearchTerm(anime.name);
    setShowAutocomplete(false);
    setAutocompleteResults([]); // Limpiar al seleccionar también

    setLoading(true);
    try {
      // Priorizar SLUG sobre ID porque la API suele responder mejor a /anime/slug
      const identifier = anime.slug || anime.id;
      const videos = await animeApi.getAnimeById(identifier);

      if (videos.length === 0) {
        toast.error('No se encontraron videos para este anime');
        setSearchResults([]);
        return;
      }

      const groupedResult = {
        animeId: anime.id,
        animeName: anime.name,
        animeYear: anime.year,
        thumbnailUrl: null,
        videos: videos,
      };

      setSearchResults([groupedResult]);
      toast.success(`${videos.length} video${videos.length !== 1 ? 's' : ''} encontrado${videos.length !== 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Error al cargar los videos del anime');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = (videos) => {
    onSelectVideos(videos);
    toast.success(`${videos.length} video${videos.length !== 1 ? 's' : ''} agregado${videos.length !== 1 ? 's' : ''} a la playlist`);
  };

  const handleAddSingleVideo = (video) => {
    onSelectVideos([video]);
    toast.success(`"${video.songTitle}" agregado a la playlist`);
  };

  const handleWatchNow = (video) => {
    onSelectVideos([video], true); // true = playNow
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-dark rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-premium-black-200">
          <div className="flex items-baseline gap-4">
            <h2 className="text-3xl font-display font-bold text-gradient-red">🔍 Buscar Anime</h2>
            <span className="text-xs md:text-sm font-mono text-neutral-500">
              API Online
            </span>
          </div>
          <button className="text-3xl text-neutral-400 hover:text-premium-red-500 transition-colors" onClick={onClose}>✕</button>
        </div>

        {/* Search Input */}
        <div className="p-6 border-b border-premium-black-200">
          <div className="relative flex gap-3">
            <input
              ref={inputRef}
              type="text"
              className="input-premium flex-1"
              placeholder="Escribe el nombre del anime..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (e.target.value.length >= 4) setShowAutocomplete(true);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                  setShowAutocomplete(false);
                }
              }}
              onFocus={() => {
                if (searchTerm.length >= 4 && autocompleteResults.length > 0) setShowAutocomplete(true);
              }}
              onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
              autoFocus
              autoComplete="off"
            />
            <button
              className="btn-premium px-6"
              onClick={() => handleSearch()}
              disabled={loading || searchTerm.trim().length < 4}
            >
              {loading ? '⏳' : '🔍'}
            </button>

            {/* Autocomplete Dropdown */}
            {showAutocomplete && searchTerm.length >= 4 && (
              <div className="absolute top-full left-0 right-16 mt-2 glass-dark rounded-lg max-h-96 overflow-y-auto z-10 border border-premium-red-900/30">
                {loadingAutocomplete && (
                  <div className="p-4 text-center text-neutral-400">
                    <span className="inline-block animate-spin">⏳</span> Buscando...
                  </div>
                )}

                {!loadingAutocomplete && autocompleteResults.length > 0 && autocompleteResults.map((anime) => (
                  <div
                    key={anime.id}
                    className="p-3 hover:bg-premium-red-900/20 cursor-pointer transition-colors flex items-center gap-3 border-b border-premium-black-200 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAutocompleteSelect(anime);
                    }}
                  >
                    <span className="text-xl">🎌</span>
                    <div className="flex-1">
                      <span className="text-neutral-100 font-medium">{anime.name}</span>
                      {anime.year && <span className="text-neutral-500 text-sm ml-2">({anime.year})</span>}
                    </div>
                  </div>
                ))}

                {!loadingAutocomplete && autocompleteResults.length === 0 && (
                  <div className="p-4 text-center text-neutral-400">
                    <div>😕 No se encontraron sugerencias</div>
                    <div className="text-sm mt-1">Presiona Enter para buscar en la API</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!loading && !searchTerm && searchResults.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎌</div>
              <h3 className="text-2xl font-display font-semibold mb-4 text-gradient-red">Cómo buscar anime</h3>
              <ul className="space-y-2 text-left max-w-md mx-auto">
                <li className="p-3 bg-premium-black-400 rounded-lg border-l-4 border-premium-red-600">✏️ Empieza a escribir el nombre del anime</li>
                <li className="p-3 bg-premium-black-400 rounded-lg border-l-4 border-premium-red-600">📋 Las sugerencias aparecen automáticamente</li>
                <li className="p-3 bg-premium-black-400 rounded-lg border-l-4 border-premium-red-600">🖱️ Haz clic en una sugerencia para ver sus videos</li>
                <li className="p-3 bg-premium-black-400 rounded-lg border-l-4 border-premium-red-600">➕ Agrega los videos que quieras a tu playlist</li>
              </ul>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 border-4 border-premium-black-200 border-t-premium-red-600 rounded-full animate-spin mb-4"></div>
              <p className="text-neutral-400">Buscando anime...</p>
            </div>
          )}

          {!loading && searchResults.length > 0 && (
            <div className="space-y-6">
              {searchResults.map((anime) => (
                <div key={anime.animeId} className="card-premium">
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-premium-black-200">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-gradient-red">{anime.animeName}</h3>
                      {anime.animeYear && <span className="text-neutral-500">{anime.animeYear}</span>}
                    </div>
                    <button
                      className="btn-premium px-4 py-2 text-sm active:scale-95 transition-transform"
                      onClick={() => handleAddToPlaylist(anime.videos)}
                    >
                      ➕ Agregar todos ({anime.videos.length})
                    </button>
                  </div>

                  <div className="space-y-4">
                    {anime.videos.map((video) => (
                      <VideoPreview
                        key={video.id}
                        video={video}
                        onAdd={handleAddSingleVideo}
                        onPlayNow={handleWatchNow}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
