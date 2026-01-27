# YourAnimeTierList

Una aplicación web de React para ver y rankear openings/endings de anime en salas compartidas.

## Características

- **Salas de Watch Party**: Crea e invita a amigos a salas compartidas
- **Reproductor de Videos**: Visualiza openings y endings de anime usando la API de AnimeThemes
- **Sistema de Ranking**: Los usuarios pueden rankear videos en tier lists (S, A, B, C, D, F)
- **Sincronización en Tiempo Real**: Todos en la sala ven el mismo contenido
- **Interfaz Intuitiva**: Diseño moderno y fácil de usar

## Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn

## Instalación

1. Clona el repositorio o descarga los archivos

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

4. Abre tu navegador en `http://localhost:3000`

## Uso

### Crear una Sala
1. En la página principal, haz clic en "Crear Sala"
2. Ingresa tu nombre
3. Comparte el código de la sala con tus amigos

### Unirse a una Sala
1. Haz clic en "Unirse a Sala"
2. Ingresa el código de la sala y tu nombre
3. ¡Disfruta viendo videos!

### Rankear Videos
- Después de cada video, podrás asignarle un tier (S, A, B, C, D, F)
- Al final de la sesión, verás un resumen con todos los rankings

## Estructura del Proyecto

```
anime-watch-party/
├── src/
│   ├── components/         # Componentes React
│   │   ├── Home.jsx       # Página principal
│   │   ├── Room.jsx       # Sala de watch party
│   │   ├── VideoPlayer.jsx # Reproductor de video
│   │   └── TierList.jsx   # Sistema de ranking
│   ├── services/          # Servicios de API
│   │   └── animeApi.js    # Cliente de AnimeThemes API
│   ├── store/             # Estado global (Zustand)
│   │   └── useStore.js    # Store principal
│   ├── styles/            # Estilos CSS
│   │   └── App.css        # Estilos globales
│   ├── App.jsx            # Componente principal
│   └── main.jsx           # Punto de entrada
├── index.html
├── package.json
└── vite.config.js
```

## API Utilizada

Este proyecto utiliza la [AnimeThemes API](https://api-docs.animethemes.moe/) para obtener videos de openings y endings de anime.

## Notas

- **Modo Demo**: Actualmente, la sincronización entre usuarios es simulada localmente. Para producción, necesitarás implementar un backend con WebSockets (Socket.io) para sincronización real.
- **Backend Opcional**: Si deseas sincronización real entre usuarios, necesitarás un servidor Node.js con Socket.io.

## Próximas Mejoras

- [ ] Backend con WebSockets para sincronización real
- [ ] Sistema de autenticación
- [ ] Persistencia de datos
- [ ] Chat en vivo en las salas
- [ ] Historial de rankings
- [ ] Compartir tier lists en redes sociales

## Licencia

MIT

## Autor

[Viaco](https://github.com/Viaco)

## Colaboradores

- [Viaco](https://github.com/Viaco)





