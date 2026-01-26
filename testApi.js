// Script de prueba para verificar la API de AnimeThemes
// Ejecutar con: node testApi.js (requiere Node.js)

const axios = require('axios');

const API_BASE_URL = 'https://api.animethemes.moe';

async function testSearchEndpoint() {
  console.log('\n=== Probando endpoint /search ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/search`, {
      params: {
        q: 'naruto',
        limit: 5,
      },
    });
    console.log('✓ /search funciona');
    console.log('Estructura:', Object.keys(response.data));
    if (response.data.search) {
      console.log('anime encontrados:', response.data.search.anime?.length || 0);
    }
  } catch (error) {
    console.log('✗ /search falló:', error.message);
  }
}

async function testAnimeFilterEndpoint() {
  console.log('\n=== Probando endpoint /anime con filtro ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/anime`, {
      params: {
        'filter[name]': 'naruto',
        'fields[anime]': 'id,name,year,slug',
        'page[size]': 5,
      },
    });
    console.log('✓ /anime con filtro funciona');
    console.log('Resultados:', response.data.anime?.length || 0);
    if (response.data.anime?.length > 0) {
      console.log('Primer resultado:', response.data.anime[0].name);
    }
  } catch (error) {
    console.log('✗ /anime con filtro falló:', error.message);
  }
}

async function testAnimeWithVideos() {
  console.log('\n=== Probando endpoint /anime con videos ===');
  try {
    const response = await axios.get(`${API_BASE_URL}/anime`, {
      params: {
        'filter[name]': 'one piece',
        'include': 'animethemes.animethemeentries.videos',
        'page[size]': 1,
      },
    });
    console.log('✓ /anime con videos funciona');
    console.log('Anime encontrados:', response.data.anime?.length || 0);
    if (response.data.anime?.length > 0) {
      const anime = response.data.anime[0];
      console.log('Anime:', anime.name);
      console.log('Themes:', anime.animethemes?.length || 0);
      if (anime.animethemes?.length > 0) {
        const theme = anime.animethemes[0];
        console.log('Primer theme:', theme.type, theme.slug);
        console.log('Entries:', theme.animethemeentries?.length || 0);
        if (theme.animethemeentries?.length > 0) {
          const entry = theme.animethemeentries[0];
          console.log('Videos:', entry.videos?.length || 0);
          if (entry.videos?.length > 0) {
            console.log('Video URL:', entry.videos[0].link);
          }
        }
      }
    }
  } catch (error) {
    console.log('✗ /anime con videos falló:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Iniciando pruebas de API...\n');
  await testSearchEndpoint();
  await testAnimeFilterEndpoint();
  await testAnimeWithVideos();
  console.log('\n✅ Pruebas completadas\n');
}

runTests();
