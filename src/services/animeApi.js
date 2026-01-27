import axios from 'axios';

const API_BASE_URL = 'http://localhost:3003/api/proxy'; // Usar Proxy Local (Puerto 3003)

// Lista local de anime populares como sugerencias inmediatas (fallback)
const LOCAL_ANIME_LIST = [
  { name: 'Naruto', slug: 'naruto' },
  { name: 'Naruto: Shippuuden', slug: 'naruto-shippuuden' },
  { name: 'One Piece', slug: 'one-piece' },
  { name: 'Attack on Titan', slug: 'shingeki-no-kyojin' },
  { name: 'My Hero Academia', slug: 'boku-no-hero-academia' },
  { name: 'Demon Slayer', slug: 'kimetsu-no-yaiba' },
  { name: 'Death Note', slug: 'death-note' },
  { name: 'Fullmetal Alchemist: Brotherhood', slug: 'fullmetal-alchemist-brotherhood' },
  { name: 'Jujutsu Kaisen', slug: 'jujutsu-kaisen' },
  { name: 'Chainsaw Man', slug: 'chainsaw-man' },
  { name: 'Spy x Family', slug: 'spy-x-family' },
  { name: 'Oshi no Ko', slug: 'oshi-no-ko' },
  { name: 'Dragon Ball Z', slug: 'dragon-ball-z' },
  { name: 'Neon Genesis Evangelion', slug: 'neon-genesis-evangelion' },
  { name: 'Frieren: Beyond Journey\'s End', slug: 'sousou-no-frieren' },
];

/**
 * Cliente para la API de AnimeThemes
 */
class AnimeThemesAPI {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Accept': 'application/json',
      },
      timeout: 15000, // Timeout de 15 segundos para evitar bloqueos
    });
  }

  /**
   * Obtiene una lista aleatoria de anime con sus themes
   * @param {number} limit - Número de resultados
   * @returns {Promise<Array>} Lista de anime con videos
   */
  async getRandomAnimeThemes(limit = 10) {
    try {
      // Generar página aleatoria
      const randomPage = Math.floor(Math.random() * 50) + 1;

      const response = await this.client.get('/anime', {
        params: {
          'include': 'animethemes.animethemeentries.videos,animethemes.song.artists,images',
          'page[size]': limit,
          'page[number]': randomPage,
          'fields[anime]': 'id,name,year,slug',
          'fields[animetheme]': 'id,type,sequence,slug',
          'fields[video]': 'id,basename,filename,link,resolution,source,tags',
        },
      });

      const formattedData = this.formatAnimeData(response.data.anime);
      return formattedData.slice(0, limit); // Asegurar que no pasamos del límite solicitado
    } catch (error) {
      console.error('Error fetching anime themes:', error);
      throw error;
    }
  }

  /**
   * Busca anime por nombre
   * @param {string} query - Término de búsqueda
   * @returns {Promise<Array>} Lista de anime con videos
   */
  async searchAnime(query) {
    try {
      console.log('🔍 Búsqueda completa para:', query);

      // Usar el parámetro 'q' para búsqueda global (optimizado)
      const response = await this.client.get('/anime', {
        params: {
          'q': query,
          'include': 'animethemes.animethemeentries.videos,animethemes.song.artists,images',
          'page[size]': 20,
        },
      });

      if (response.data.anime && response.data.anime.length > 0) {
        return this.formatAnimeData(response.data.anime);
      }

      // Fallback: Intento con filter[name] (búsqueda flexible)
      console.log('⚠️ Intentando búsqueda flexible...');
      const flexibleResponse = await this.client.get('/anime', {
        params: {
          'filter[name]': query,
          'include': 'animethemes.animethemeentries.videos,animethemes.song.artists,images',
          'page[size]': 20,
        },
      });

      if (flexibleResponse.data.anime && flexibleResponse.data.anime.length > 0) {
        return this.formatAnimeData(flexibleResponse.data.anime);
      }

      return [];

    } catch (error) {
      console.error('❌ Error searching anime:', error);
      throw error;
    }
  }

  /**
   * Busca anime por nombre para autocompletado (Búsqueda ONLINE optimizada)
   * @param {string} query - Término de búsqueda
   * @returns {Promise<Array>} Lista simplificada de anime
   */
  async searchAnimeAutocomplete(query) {
    const searchTerm = query.trim();
    if (searchTerm.length < 4) return [];

    try {
      // Búsqueda directa con 'q' (Search Index)
      const response = await this.client.get('/anime', {
        params: {
          'q': searchTerm,
          'page[size]': 8,
          'fields[anime]': 'id,name,year,slug',
        }
      });

      let animeList = response.data.anime || [];

      // Fallback: Si 'q' no devuelve nada, intentar filter[name]
      if (animeList.length === 0) {
        try {
          const fallbackRes = await this.client.get('/anime', {
            params: {
              'filter[name]': searchTerm,
              'page[size]': 8,
              'fields[anime]': 'id,name,year,slug',
            }
          });
          if (fallbackRes.data.anime) {
            animeList = fallbackRes.data.anime;
          }
        } catch (e) {
          console.warn('Fallback search failed');
        }
      }

      // Mapear al formato esperado
      let results = animeList.map(anime => ({
        id: anime.slug || anime.id,
        slug: anime.slug,
        name: anime.name,
        year: anime.year,
        baseName: anime.name
      }));

      // Si la API no devuelve nada, filtrar de la lista local
      if (results.length === 0) {
        const localMatches = LOCAL_ANIME_LIST.filter(anime =>
          anime.name.toLowerCase().includes(searchTerm.toLowerCase())
        ).map(anime => ({
          id: anime.slug,
          slug: anime.slug,
          name: anime.name,
          year: null,
          baseName: anime.name
        }));
        results = localMatches;
      }

      return results;

    } catch (error) {
      console.warn('Error en autocompletado online:', error);
      return [];
    }
  }

  async getAnimeById(idOrSlug, retries = 3) {
    try {
      try {
        const response = await this.client.get(`/anime/${idOrSlug}`, {
          params: {
            'include': 'animethemes.animethemeentries.videos,animethemes.song.artists,images',
          },
        });

        if (!response.data || !response.data.anime) {
          throw new Error('API returned empty anime data');
        }

        return this.formatAnimeData([response.data.anime]);

      } catch (firstError) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          return this.getAnimeById(idOrSlug, retries - 1);
        }
        return [];
      }
    } catch (error) {
      console.error('Error fetching anime by ID after retries:', error);
      throw error;
    }
  }

  /**
   * Obtiene videos de themes populares
   * @returns {Promise<Array>} Lista de videos populares
   */
  async getPopularThemes() {
    try {
      const response = await this.client.get('/animetheme', {
        params: {
          'include': 'animethemeentries.videos,anime',
          'page[size]': 20,
          'sort': '-animethemeentries.videos.views',
        },
      });

      return this.formatThemeData(response.data.animethemes);
    } catch (error) {
      console.error('Error fetching popular themes:', error);
      throw error;
    }
  }

  /**
   * Formatea los datos de anime para uso en la aplicación
   * @param {Array} animeList - Lista de anime de la API
   * @returns {Array} Lista formateada de videos
   */
  formatAnimeData(animeList) {
    const videos = [];

    animeList.forEach(anime => {
      if (!anime || !anime.animethemes) return;

      anime.animethemes.forEach(theme => {
        if (!theme.animethemeentries) return;

        theme.animethemeentries.forEach(entry => {
          if (!entry.videos || entry.videos.length === 0) return;

          // Tomar el primer video disponible (preferiblemente el de mejor calidad)
          const video = entry.videos.sort((a, b) => {
            const resA = parseInt(a.resolution) || 0;
            const resB = parseInt(b.resolution) || 0;
            return resB - resA;
          })[0];

          const videoUrl = video.link.startsWith('http')
            ? video.link
            : `https://v.animethemes.moe/${video.basename}`;

          videos.push({
            id: `${anime.id}-${theme.id}-${video.id}`,
            animeId: anime.id,
            animeName: anime.name,
            animeYear: anime.year,
            animeSlug: anime.slug,
            themeName: theme.slug,
            themeType: theme.type,
            themeSequence: theme.sequence || null,
            songTitle: theme.song?.title || 'Unknown Song',
            artist: theme.song?.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
            videoUrl: videoUrl,
            videoBasename: video.basename,
            videoFilename: video.filename,
            resolution: video.resolution,
            source: video.source,
            tags: video.tags || '',
            thumbnailUrl: anime.images?.[0]?.link || null,
          });
        });
      });
    });

    return videos;
  }

  /**
   * Formatea los datos de themes para uso en la aplicación
   * @param {Array} themeList - Lista de themes de la API
   * @returns {Array} Lista formateada de videos
   */
  formatThemeData(themeList) {
    const videos = [];

    themeList.forEach(theme => {
      if (!theme.animethemeentries || !theme.anime) return;

      theme.animethemeentries.forEach(entry => {
        if (!entry.videos || entry.videos.length === 0) return;

        const video = entry.videos[0];

        videos.push({
          id: `${theme.anime.id}-${theme.id}-${video.id}`,
          animeId: theme.anime.id,
          animeName: theme.anime.name,
          animeYear: theme.anime.year,
          themeName: theme.slug,
          themeType: theme.type,
          songTitle: theme.song?.title || 'Unknown Song',
          artist: theme.song?.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
          videoUrl: `https://animethemes.moe${video.link}`,
          videoBasename: video.basename,
          resolution: video.resolution,
          source: video.source,
          thumbnailUrl: theme.anime.images?.[0]?.link || null,
        });
      });
    });

    return videos;
  }
}

// Exportar instancia única
const animeApi = new AnimeThemesAPI();
export default animeApi;
