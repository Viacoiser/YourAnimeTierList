# DOCUMENTO DE IMPLEMENTACIÓN EXHAUSTIVO - Wait Mode V2

**Proyecto:** YourAnimeTierList (YATL)  
**Versión:** V2 - Wait Mode Implementation  
**Fecha:** Enero 2026  
**Estado:** Plan Detallado (Pre-Implementación)

---

## 📖 TABLA DE CONTENIDOS

1. [Entendimiento del Proyecto](#entendimiento-del-proyecto)
2. [Arquitectura General](#arquitectura-general)
3. [Componentes del Sistema](#componentes-del-sistema)
4. [Flujos de Datos](#flujos-de-datos)
5. [Especificaciones Técnicas](#especificaciones-técnicas)
6. [Integración Docker](#integración-docker)
7. [Plan de Implementación Secuencial](#plan-de-implementación-secuencial)
8. [Testing y Debugging](#testing-y-debugging)
9. [Matriz de Decisiones](#matriz-de-decisiones)

---

## 🎯 ENTENDIMIENTO DEL PROYECTO

### 1.1 Concepto General: YourAnimeTierList

**Nombre del Proyecto:** YourAnimeTierList (YATL)  
**Propósito:** Plataforma web colaborativa para ver y rankear openings/endings de anime en salas compartidas  
**Usuarios:** Máximo 10 por sala  
**Tecnología:** React (frontend) + Node.js Express (backend) + MySQL (base de datos)  
**Infraestructura Actual:** XAMPP + MySQL  
**Target:** Integración Docker para mejor escalabilidad

---

### 1.2 Dos Modos de Operación

#### MODO NORMAL - Reproducción Inmediata
```
Host selecciona video
    ↓
Todos reproducen de inmediato (sin sincronización de carga)
    ↓
Riesgo: alguien se atrasa si conexión es lenta
    ↓
Caso de uso: Salas pequeñas o conexiones excelentes
```

**Características:**
- Latencia mínima
- Reproducción inmediata
- Sin espera obligatoria
- Mejor para usuarios con buena conexión

---

#### MODO ESPERA (WAIT MODE) - V2 [ENFOQUE ACTUAL]

**Propósito:** Garantizar que todos estén listos antes de reproducir, evitando desincronización

```
1. Usuario entra a sala
    ↓
2. Video comienza a descargar automáticamente
    ↓
3. Barras de progreso aparecen para todos (incluyendo host)
    ↓
4. Carga HORIZONTAL: todos cargan hasta mínimo 50%
    ↓
5. Host ve indicador visual "X de Y listos"
    ↓
6. Host presiona PLAY o FORCE PLAY
    ↓
7. Todos se sincronizan automáticamente (seek)
    ↓
8. Video reproduciendo (barras desaparecen)
    ↓
9. Siguiente video en lista se precarga en background
    ↓
10. Cuando video actual termina → siguiente en WAIT MODE
```

##### WAIT MODE NORMAL
- Host presiona PLAY
- Todos comienzan reproducción desde su posición de sincronización
- Si alguien está en 10% mientras otros en 50%:
  - El atrasado hace SEEK automático a la posición actual
  - Entra en buffering mientras se reproduce
  - Otros continúan sin pausa
- **Riesgo:** Usuario rezagado puede experimentar pauses frecuentes

##### WAIT MODE HARDCORE
- Host presiona PLAY
- Si alguien reconecta o entra en buffering durante reproducción:
  - **VIDEO SE PAUSA PARA TODOS**
  - Se espera a que usuario rezagado cargue
  - Cuando alcanza 50%+ → todos reanudan juntos
- **Garantía:** Sincronización perfecta pero con potencial latencia

---

### 1.3 Flujo de Usuario Típico

#### Usuario HOST
```
1. Crea sala con parámetros:
   - Tipo de espera (Normal o Hardcore)
   - Lista de reproducción (openings/endings)

2. Espera a que guests entren y carguen

3. Monitorea barras de progreso en tiempo real

4. Cuando "X de Y listos" aparece:
   a) Puede presionar PLAY (espera consenso)
   b) Puede presionar FORCE PLAY (inicia sin esperar)

5. Ve video reproduciendo

6. Cuando termina:
   a) Siguiente video se carga automáticamente
   b) Vuelve al paso 3 (monitoreo de progreso)

7. Opcionalmente: rankea openings/endings (futura feature)

8. Cierra sala cuando termina
```

#### Usuario GUEST (Participante)
```
1. Entra a código de sala
2. Se conecta a la sala
3. Video comienza a cargar automáticamente
4. Ve su barra de progreso + barras de otros usuarios
5. Cuando host presiona PLAY:
   a) Si está ≥50%: continúa desde donde está
   b) Si está <50%: hace seek + buffering
6. Ve video reproduciendo
7. Cuando termina: siguiente video se precarga
8. Repite desde paso 5
9. Puede abandonar sala en cualquier momento
```

---

### 1.4 Requisitos Clave del Sistema

#### Funcionales
- ✅ Sincronización de reproducción en tiempo real
- ✅ Cálculo de progreso de carga por usuario (cada 1 segundo)
- ✅ Notificación automática cuando todos están listos (≥50%)
- ✅ Soporte para modo Normal y Hardcore Wait Mode
- ✅ Precarga de siguiente video durante reproducción
- ✅ Recuperación ante desconexiones (reconexión en 2 minutos)
- ✅ Asignación automática de nuevo host si se desconecta
- ✅ Sistema de caché inteligente (500MB por usuario, 5 min TTL)

#### No Funcionales
- ✅ Latencia <200ms para notificaciones
- ✅ Máximo 10 usuarios por sala
- ✅ Soporte para 3+ salas simultáneas
- ✅ Descarga desde AnimeThemes API sin excepciones
- ✅ IndexedDB para caché local (sin serverload)
- ✅ Escalable a Docker para deploys

---

## 🏗️ ARQUITECTURA GENERAL

### 2.1 Stack Tecnológico

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (React)                │
│  ┌──────────────────────────────────────────┐  │
│  │ Components:                              │  │
│  │ - Room.jsx (contenedor principal)        │  │
│  │ - VideoPlayer.jsx (reproducción)         │  │
│  │ - WaitModeOverlay.jsx (overlay espera)   │  │
│  │ - ProgressBarsOverlay.jsx (barras)       │  │
│  │ - HostControlPanel.jsx (controles host)  │  │
│  └──────────────────────────────────────────┘  │
│                        ↓ (Socket.io)            │
├─────────────────────────────────────────────────┤
│                  BACKEND (Node.js)              │
│  ┌──────────────────────────────────────────┐  │
│  │ Modules:                                 │  │
│  │ - socket.js (eventos Socket.io)          │  │
│  │ - roomManager.js (lógica de salas)       │  │
│  │ - throttleManager.js (rate limiting API) │  │
│  │ - cacheManager.js (metadata caché)       │  │
│  │ - sessionManager.js (persistencia sesión)│  │
│  │ - apiHandler.js (AnimeThemes API)        │  │
│  └──────────────────────────────────────────┘  │
│                        ↓ (HTTP/API)             │
├─────────────────────────────────────────────────┤
│                   ALMACENAMIENTO                │
│  ┌──────────────────────────────────────────┐  │
│  │ MySQL: datos de usuarios, salas, ranks   │  │
│  │ Redis: sesiones, caché temporal          │  │
│  │ IndexedDB (cliente): videos caché        │  │
│  │ localStorage: sessionId, preferencias    │  │
│  └──────────────────────────────────────────┘  │
│                        ↓ (HTTP)                 │
├─────────────────────────────────────────────────┤
│                   APIS EXTERNAS                 │
│  ┌──────────────────────────────────────────┐  │
│  │ AnimeThemes API (metadatos + URLs)       │  │
│  │ media.animethemes.moe CDN (descargas)    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 2.2 Flujo de Datos de Alto Nivel

```
┌──────────────────────────────────────────────────────────────────┐
│ USUARIO ENTRA A SALA                                             │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLIENTE (React)                                                   │
│ - Genera/recupera sessionId                                       │
│ - Se conecta a Socket.io                                          │
│ - Emite 'join-room' con sessionId + roomId                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ SERVIDOR (Node.js)                                               │
│ - Valida sessionId (no 2 conexiones activas)                     │
│ - Agrega usuario a sala                                          │
│ - Si es primer usuario → asigna como host                        │
│ - Emite a todos: 'user-joined'                                   │
│ - Obtiene playlist de BD                                         │
│ - Emite a nuevo usuario: 'room-state' (datos sala actual)        │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLIENTE RECIBE ESTADO                                             │
│ - Guarda roomState en store (Zustand)                            │
│ - Identifica video actual en playlist                            │
│ - Inicia descarga de video (IndexedDB)                           │
│ - Comienza a emitir progreso cada 1 segundo                      │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ SERVIDOR RECIBE PROGRESO                                          │
│ - Evento: 'progress-update' { videoId, progress, sessionId }    │
│ - Actualiza progressMap[roomId][sessionId] = progress            │
│ - Si progress >= 50%: agrega a usersReadyAt50                   │
│ - Si todos >= 50%: emite 'all-ready' a host                     │
│ - Emite 'progress-broadcast' a todos (actualizar barras)         │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLIENTE VE BARRAS DE PROGRESO                                    │
│ - ProgressBarsOverlay.jsx renderiza barras coloreadas            │
│ - Rojo: 0-39%, Amarillo: 40-49%, Verde: 50-100%                │
│ - Actualiza cada 1 segundo                                       │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ HOST VE "X DE Y LISTOS"                                           │
│ - Toast notification: "Todos listos"                             │
│ - Host Control Panel muestra botones: PLAY / FORCE PLAY          │
│ - Host presiona PLAY                                             │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ EVENTO: VIDEO-START                                              │
│ - Host emite 'force-play' o 'play' al servidor                  │
│ - Servidor validar host + emite 'video-start' a TODOS           │
│ - Estructura: { videoId, timestamp, currentTime, waitModeType }  │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ CLIENTE SINCRONIZA                                                │
│ - Calcula seekTime = (Date.now() - timestamp) + currentTime      │
│ - VideoElement.seek(seekTime)                                    │
│ - Cuando ready → play()                                          │
│ - ProgressBarsOverlay desaparece                                 │
└──────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────────┐
│ DURANTE REPRODUCCIÓN                                              │
│ - NO se envía progreso de carga                                  │
│ - Se monitorea buffering (para Hardcore mode)                    │
│ - Se precarga siguiente video en background                      │
│ - Cuando termina video → siguientes 5 pasos se repiten           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 COMPONENTES DEL SISTEMA

### 3.1 Frontend - Componentes React

#### 3.1.1 Room.jsx (Contenedor Principal)
**Responsabilidades:**
- Conectar con Socket.io
- Mantener estado de sala (Zustand store)
- Renderizar overlay correcto (wait mode vs playing)
- Manejar transiciones entre estados

**State que maneja:**
```
roomId: string
roomMembers: User[]
currentVideo: Video
playlist: Video[]
roomState: 'WAITING' | 'PLAYING' | 'CLOSED'
waitModeType: 'normal' | 'hardcore'
isHost: boolean
currentUser: User
```

**Eventos Socket que escucha:**
```
- 'user-joined'
- 'user-left'
- 'room-state'
- 'all-ready' (toast notification)
- 'video-start'
- 'progress-broadcast'
- 'video-ended'
- 'host-changed'
```

**Eventos que emite:**
```
- 'join-room'
- 'progress-update'
- 'play'
- 'force-play'
- 'leave-room'
```

---

#### 3.1.2 VideoPlayer.jsx (Reproducción)
**Responsabilidades:**
- Renderizar elemento `<video>`
- Controlar play/pause/seek
- Detectar eventos de buffering
- Calcular tiempo actual
- Manejar URL del video

**Props esperadas:**
```
video: Video { id, url, duration, title }
autoPlay: boolean
onPlay: (time) => void
onPause: () => void
onEnded: () => void
onBuffering: (isBuffering) => void
onTimeUpdate: (time) => void
onLoadProgress: (progress) => void
waitModeType: 'normal' | 'hardcore'
```

**Métodos públicos:**
```
seek(time: number): void
play(): Promise<void>
pause(): Promise<void>
getCurrentTime(): number
```

---

#### 3.1.3 WaitModeOverlay.jsx (Overlay Espera)
**Responsabilidades:**
- Mostrar overlay bloqueante durante WAIT MODE
- Mostrar información de progreso de carga
- Mostrar botones de control (solo para host)

**Props esperadas:**
```
roomMembers: User[]
progressMap: Map<sessionId, number>
isHost: boolean
waitModeType: 'normal' | 'hardcore'
onPlay: () => void
onForcePlay: () => void
allReady: boolean
```

**UI Elements:**
```
- Título: "Esperando que todos carguen"
- Contador: "3 de 4 usuarios listos"
- Barras de progreso por usuario
- Botones: [PLAY] [FORCE PLAY] (solo si es host)
```

---

#### 3.1.4 ProgressBarsOverlay.jsx (Barras Visuales)
**Responsabilidades:**
- Renderizar barra de progreso por usuario
- Actualizar colores según porcentaje (rojo/amarillo/verde)
- Mostrar nombre de usuario + porcentaje
- Desaparecer cuando video comienza

**Props esperadas:**
```
users: User[]
progressMap: Map<sessionId, number>
visible: boolean
```

**Lógica de colores:**
```javascript
if (progress < 40) color = RED      // 0-39%
if (progress >= 40 && progress < 50) color = YELLOW // 40-49%
if (progress >= 50) color = GREEN   // 50-100%
```

---

#### 3.1.5 HostControlPanel.jsx (Controles Host)
**Responsabilidades:**
- Mostrar solo si usuario es host
- Mostrar estado actual de sala
- Proporcionar botones PLAY / FORCE PLAY
- Mostrar notificación "Todos listos"

**Props esperadas:**
```
isHost: boolean
allReady: boolean
progressMap: Map<sessionId, number>
roomMembers: User[]
onPlay: () => void
onForcePlay: () => void
```

**Botones condicionales:**
```
- PLAY: habilitado si allReady = true
- FORCE PLAY: siempre habilitado
```

---

#### 3.1.6 LoadingProgress.jsx (Indicador de Carga)
**Responsabilidades:**
- Mostrar barra de progreso de descarga del VIDEO ACTUAL
- Mostrar porcentaje y velocidad de descarga
- Desaparecer cuando video está 100% listo

**Props esperadas:**
```
videoId: string
progress: number (0-100)
downloadSpeed: number (bytes/sec)
estimatedTime: number (seconds)
```

---

### 3.2 Backend - Módulos Node.js

#### 3.2.1 socket.js (Eventos Socket.io)
**Responsabilidades:**
- Manejar conexión/desconexión de clientes
- Procesar eventos desde clientes
- Emitir eventos a clientes
- Validaciones de integridad

**Eventos manejados:**
```
'connect': usuario conecta
'join-room': usuario entra a sala
'progress-update': usuario envía progreso
'play': host inicia reproducción
'force-play': host fuerza reproducción
'leave-room': usuario abandona sala
'disconnect': usuario desconecta (timeout 2 min)
'user-buffering-start': (Hardcore mode)
'user-buffering-end': (Hardcore mode)
```

**Validaciones:**
```
- sessionId debe ser válido
- Usuario debe estar en roomId
- Solo host puede emitir 'play' y 'force-play'
- progress debe ser número 0-100
- videoId debe existir en playlist
```

---

#### 3.2.2 roomManager.js (Lógica de Salas)
**Responsabilidades:**
- Crear/cerrar salas
- Agregar/remover usuarios
- Gestionar estado de sala (WAITING/PLAYING)
- Calcular cuando "todos listos"
- Asignar nuevo host
- Limpiar usuarios desconectados

**Métodos principales:**
```
createRoom(roomId, hostSessionId): Room
addUser(roomId, sessionId, socketId, user): void
removeUser(roomId, sessionId): void
updateProgress(roomId, sessionId, videoId, progress): void
getAllReady(roomId): boolean
getRoom(roomId): Room | null
assignNewHost(roomId): void
cleanupRoom(roomId): void
getProgressMap(roomId): Map<sessionId, number>
```

**Estructura Room:**
```javascript
{
  id: string,
  hostSessionId: string,
  users: Map<sessionId, User>,
  currentVideo: Video,
  playlist: Video[],
  state: 'WAITING' | 'PLAYING' | 'CLOSED',
  progressMap: Map<sessionId, number>,
  usersReadyAt50: Set<sessionId>,
  createdAt: timestamp,
  playStartTime: timestamp,
  waitModeType: 'normal' | 'hardcore',
  bufferingUsers: Set<sessionId> (para hardcore)
}
```

---

#### 3.2.3 sessionManager.js (Persistencia de Sesión)
**Responsabilidades:**
- Generar y validar sessionIds
- Trackear reconexiones
- Limpiar sesiones expiradas (2 minutos)
- Detectar intentos de duplicación (mismo sessionId, diferente IP)

**Métodos principales:**
```
validateOrCreateSession(socketId, ip, userAgent): sessionId
isSessionActive(sessionId): boolean
reconnectSession(sessionId, newSocketId): void
markDisconnected(sessionId, timestamp): void
isExpired(sessionId, timeout=2min): boolean
cleanupExpiredSessions(): void
detectDuplicateSession(sessionId, ip, userAgent): boolean
```

**Estructura SessionTracker:**
```javascript
{
  sessionId: {
    socketId: string,
    ip: string,
    userAgent: string,
    createdAt: timestamp,
    lastActivity: timestamp,
    isDisconnected: boolean,
    disconnectTime: timestamp
  }
}
```

---

#### 3.2.4 throttleManager.js (Rate Limiting API)
**Responsabilidades:**
- Controlar requests a AnimeThemes API
- Implementar cola de solicitudes
- Deduplicar requests (2 usuarios buscan lo mismo = 1 request)
- Reintentos con backoff exponencial

**Métodos principales:**
```
requestAPI(endpoint, priority='normal'): Promise<response>
enqueueSafeSearch(query): Promise<searchResults>
enqueueVideoFetch(videoId): Promise<videoMetadata>
isRateLimited(roomId): boolean
getQueueLength(): number
deduplicateRequest(key): Promise<cachedResult | newRequest>
```

**Límites:**
```
- Máximo 2 requests/seg POR SALA
- Máximo 10 requests/seg GLOBAL
- Máximo 3 reintentos por solicitud
- Backoff: 1s, 2s, 4s
```

**Estructura Queue:**
```javascript
{
  requestKey: string,
  endpoint: string,
  roomId: string,
  priority: number,
  addedAt: timestamp,
  attempts: number,
  lastAttempt: timestamp
}
```

---

#### 3.2.5 cacheManager.js (Caché Metadata)
**Responsabilidades:**
- Almacenar metadata de videos en Redis (TTL 1 hora)
- Almacenar resultados de búsquedas (TTL 1 hora)
- Deduplicar requests a API (mismo video = 1 fetch)

**Métodos principales:**
```
getVideoMetadata(videoId): Promise<metadata>
setVideoMetadata(videoId, metadata, ttl=3600): void
getSearchResults(query): Promise<results>
setSearchResults(query, results, ttl=3600): void
invalidateCache(key): void
clearExpiredCache(): void
```

**Keys Redis:**
```
video:{videoId} → metadata (TTL 1h)
search:{query} → results (TTL 1h)
session:{sessionId} → userData (TTL 5min)
```

---

#### 3.2.6 apiHandler.js (Integración AnimeThemes)
**Responsabilidades:**
- Hacer requests a AnimeThemes API
- Parsear respuestas
- Obtener URLs de videos
- Manejar errores y timeouts

**Métodos principales:**
```
searchAnime(query): Promise<animes[]>
getAnimeDetails(animeId): Promise<anime>
getThemesForAnime(animeId): Promise<themes[]>
getThemeDetails(themeId): Promise<themeDetails>
getVideoMetadata(videoId): Promise<videoMeta>
getVideoUrl(videoId): Promise<url>
```

**Estructura de datos esperada:**
```javascript
anime: {
  id: number,
  name: string,
  year: number,
  season: string
}

theme: {
  id: number,
  type: 'OP' | 'ED',
  sequence: number,
  title: string,
  entries: animethemeentry[]
}

video: {
  id: number,
  filename: string,
  link: string,
  size: number,
  resolution: string
}
```

---

### 3.3 Cliente - Servicios y Hooks

#### 3.3.1 useSocket.js (Hook Socket.io)
**Responsabilidades:**
- Conectar/desconectar Socket.io
- Emitir eventos
- Escuchar eventos
- Manejar reconexiones automáticas

**Métodos:**
```
useSocket(url): {
  emit: (event, data) => void,
  on: (event, callback) => void,
  off: (event, callback) => void,
  connected: boolean,
  error: Error | null
}
```

---

#### 3.3.2 CacheManager.js (Caché IndexedDB Cliente)
**Responsabilidades:**
- Guardar videos en IndexedDB (500MB máximo por usuario)
- Recuperar videos en caché
- Limpiar caché expirado (5 minutos)
- Implementar FIFO cuando se llena

**Métodos:**
```
async saveVideo(videoId, blob): Promise<void>
async getVideo(videoId): Promise<Blob | null>
async deleteVideo(videoId): Promise<void>
async clearExpired(): Promise<void>
async getStorageSize(): Promise<number>
async getVideoProgress(videoId): Promise<number>
async resumeDownload(videoId): Promise<void>
```

**Estructura IndexedDB:**
```javascript
database: 'YATLCache'
stores: {
  'videos': {
    keyPath: 'videoId',
    indexes: ['sessionId', 'roomId', 'expiresAt']
  },
  'downloads': {
    keyPath: 'videoId',
    indexes: ['progress', 'addedAt']
  }
}
```

---

#### 3.3.3 animeApi.js (Cliente-side API Handler)
**Responsabilidades:**
- Solicitar videos a servidor (con queuing)
- Cachear resultados locales
- Emitir eventos de progreso

**Métodos:**
```
async requestVideoDownload(videoId): Promise<url>
async searchAnime(query): Promise<animes[]>
onDownloadProgress(callback): void
```

---

### 3.4 Almacenamiento

#### 3.4.1 MySQL Schema
```sql
-- Salas
CREATE TABLE rooms (
  id VARCHAR(36) PRIMARY KEY,
  host_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),
  wait_mode ENUM('normal', 'hardcore'),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Usuarios en salas
CREATE TABLE room_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(36) FOREIGN KEY,
  session_id VARCHAR(36) UNIQUE,
  socket_id VARCHAR(100),
  username VARCHAR(100),
  is_host BOOLEAN,
  joined_at TIMESTAMP,
  left_at TIMESTAMP
);

-- Playlists
CREATE TABLE playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(36) FOREIGN KEY,
  title VARCHAR(255),
  created_by VARCHAR(36),
  created_at TIMESTAMP
);

-- Playlist items
CREATE TABLE playlist_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  playlist_id INT FOREIGN KEY,
  video_id INT,
  title VARCHAR(255),
  position INT,
  duration INT (segundos)
);

-- Rankings/Ratings (future feature)
CREATE TABLE video_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  video_id INT,
  user_id VARCHAR(36),
  rating INT (1-10),
  room_id VARCHAR(36),
  created_at TIMESTAMP
);
```

---

#### 3.4.2 Redis Schema
```
video:{videoId} → JSON metadata
search:{query} → JSON results
session:{sessionId} → JSON userData (TTL 5min)
room:{roomId}:progress → Hash<sessionId, progress>
room:{roomId}:users → List<sessionId>
queue:api → List<requests>
```

---

## 🔄 FLUJOS DE DATOS

### 4.1 Flujo: Usuario Entra a Sala

```
CLIENTE                          SERVIDOR                        STORAGE
   │                                │                               │
   ├─ Lee localStorage             │                               │
   │  (sessionId)                  │                               │
   │                               │                               │
   ├─ Conecta Socket.io            │                               │
   │                               │                               │
   ├─ Emite 'join-room'           │                               │
   │  {roomId, sessionId}           │                               │
   │                               ├─ Valida sessionId             │
   │                               │                               │
   │                               ├─ Busca room                   ├─ SELECT * FROM rooms
   │                               │                               │
   │                               ├─ Agrega user a room           ├─ INSERT room_members
   │                               │                               │
   │                               ├─ Si primer user:              │
   │                               │   asigna como host            │
   │                               │                               │
   │                               ├─ Obtiene playlist             ├─ SELECT * FROM playlist_items
   │                               │                               │
   │◄─────────'room-state'────────┤                               │
   │  {roomMembers, currentVideo}  │                               │
   │                               │                               │
   ├─ Guarda en Zustand            │                               │
   │                               │                               │
   ├─ Inicia descarga video        │                               │
   │                               │                               │
   ├─ Emite 'progress-update'      │                               │
   │  cada 1 segundo               ├─ Actualiza progress           ├─ Redis: room:{roomId}:progress
   │                               │                               │
   │                               ├─ Si >=50%:                    │
   │                               │   agrega a usersReadyAt50     │
   │                               │                               │
   │                               ├─ Si todos >=50%:              │
   │◄──'all-ready' (toast)─────────┤   emite 'all-ready'           │
```

---

### 4.2 Flujo: Host Presiona PLAY

```
HOST (CLIENTE)                   SERVIDOR                        OTROS CLIENTES
       │                              │                               │
       ├─ Presiona botón PLAY         │                               │
       │                              │                               │
       ├─ Emite 'force-play'          │                               │
       │ {videoId, roomId}            │                               │
       │                              │                               │
       │                              ├─ Valida: ¿es host?            │
       │                              │                               │
       │                              ├─ Calcula timestamp            │
       │                              │                               │
       │                              ├─ Emite 'video-start'          │
       │                              │ {videoId, timestamp, waitMode}│
       │                              │                               ├─ Calcula seekTime
       │                              │                               │
       │                              │                               ├─ VideoElement.seek()
       │                              │                               │
       │                              │                               ├─ VideoElement.play()
       │                              │                               │
       │                              │                               ├─ ProgressBars desaparece
       │                              │                               │
       │                              ├─ Actualiza roomState          │
       │◄─'video-start'───────────────┤ PLAYING                       │
       │                              │                               │
       ├─ VideoElement.seek()         │                               │
       │                              │                               │
       ├─ VideoElement.play()         │                               │
       │                              │                               │
       ├─ ProgressBars desaparece     │                               │
```

---

### 4.3 Flujo: Usuario Desconecta (Timeout 2 min)

```
USUARIO DESCONECTADO            SERVIDOR                        OTROS USUARIOS
         │                           │                                 │
         ├─ Socket cierra            │                                 │
         │                           │                                 │
         │                           ├─ Inicia timer 2 min             │
         │                           │                                 │
         │                           ├─ Espera reconexión...           │
         │                           │                                 │
         │                     [2 minutos sin reconexión]              │
         │                           │                                 │
         │                           ├─ Ejecuta cleanupUser()          │
         │                           │  - Remueve de room              │
         │                           │  - Remueve de progressMap       ├─ Recibe 'user-left'
         │                           │  - Remueve de caché             │  {sessionId}
         │                           │  - Actualiza contador           │
         │                           │                                 ├─ UI: "3 de 3" en lugar de "3 de 4"
         │                           │                                 │
         │                           ├─ Si es HOST:                    │
         │                           │   asigna nuevo host             ├─ Recibe 'host-changed'
         │                           │                                 │
         │                           ├─ Emite 'user-left'              │
         │                           │  a todos clientes               │
```

---

### 4.4 Flujo: Precarga de Siguiente Video

```
DURANTE REPRODUCCIÓN VIDEO ACTUAL   SERVIDOR                   CLIENTE (BACKGROUND)
                │                        │                              │
                │                        │                              │
                │                        │                              │
         [Video en minuto 4]             │                              │
                │                        │                              │
                │                        ├─ Identifica nextVideoId      │
                │                        │                              │
                │                        ├─ Emite 'preload-next'        │
                │                        │ {nextVideoId, priority}      │
                │                        │                              ├─ Recibe 'preload-next'
                │                        │                              │
                │                        │                              ├─ Inicia descarga
                │                        │                              │  en background (baja prioridad)
                │                        │                              │
                │                        │                              ├─ Guarda en IndexedDB
                │                        │                              │
                │                        │                              ├─ Emite 'preload-progress'
                │                        │◄────────────────────────────┤
                │                        │                              │
         [Video termina]                 │                              │
                │                        │                              │
                │                        ├─ Video siguiente ya 50%+     │
                │                        │  en caché del usuario        │
                │                        │                              │
                │                        ├─ Emite 'video-next'          │
                │                        │                              ├─ Vuelve a WAIT MODE
```

---

### 4.5 Flujo: Throttling de API

```
USUARIO 1 busca "Attack on Titan"    SERVIDOR                    USUARIO 2 busca "Attack on Titan"
         │                                │                              │
         ├─ Emite 'request-search'       │                              │
         │ {query}                       │                              │
         │                               ├─ Agrega a cola              │
         │                               │ priority=10                  │
         │                               │ (espera 200ms)               │
         │                               │                              ├─ Emite 'request-search'
         │                               │                              │ {query} (mismo)
         │                               │                              │
         │                               ├─ Detecta request duplicado  │
         │                               │                              │
         │                               ├─ En lugar de 2 requests:     │
         │                               │  hace 1 solo                 │
         │                               │                              │
         │                               ├─ HTTP GET /api/search       │
         │                               │  "Attack on Titan"           │
         │                               │                              │
         │                               ├─ Cachea resultado           ├─ Redis
         │                               │  (TTL 1 hora)                │
         │                               │                              │
         │◄──'search-results'────────────┤                              │
         │                               ├─ Emite 'search-results'─────┤
         │                               │  (mismo resultado)           │
```

---

## 🔧 ESPECIFICACIONES TÉCNICAS

### 5.1 Protocolos y Comunicación

#### WebSocket (Socket.io)
- **Protocolo:** WebSocket con fallback HTTP polling
- **Frecuencia actualización:** Cada 1 segundo (progress)
- **Tamaño payload:** ~500 bytes por evento
- **Latencia máxima aceptable:** <200ms

#### HTTP (AnimeThemes API)
- **Base URL:** `https://api.animethemes.moe/`
- **Rate Limit:** 2 req/seg por sala, 10 req/seg global
- **Timeout:** 5 segundos por request
- **Reintentos:** 3 intentos con backoff (1s, 2s, 4s)

#### CORS
- ✅ AnimeThemes API permite CORS
- ✅ media.animethemes.moe CDN permite CORS
- ✅ Cliente puede descargar directamente sin proxy

---

### 5.2 Especificación de SessionId

**Generación:**
```
Format: UUID v4
Ejemplo: "550e8400-e29b-41d4-a716-446655440000"
Almacenamiento cliente:
  - localStorage: "yatl_user_session_id"
  - sessionStorage: "yatl_room_session_{roomId}"
TTL: 
  - localStorage: indefinido (persiste entre sesiones)
  - sessionStorage: hasta cerrar tab
```

**Validación servidor:**
```
1. Recibe sessionId en 'join-room'
2. Valida formato (UUID v4)
3. Verifica no haya 2 conexiones activas:
   - SI mismo sessionId + diferente IP → rechaza
   - SI mismo sessionId + mismo IP → permite (reconexión)
   - SI nuevo sessionId → crea nuevo entry
4. Almacena en sessionConnections map
5. Expira después 2 minutos sin actividad
```

---

### 5.3 Especificación de Progreso de Carga

**Cálculo cliente:**
```
totalBytes = 50 * 1024 * 1024  // Asumido 50MB para openings
downloadedBytes = fileSize a la fecha
progress = (downloadedBytes / totalBytes) * 100

Envío: cada 1 segundo SI ha cambiado desde último envío
```

**Estados por usuario:**
```
LOADING: 0-49% (rojo)
BUFFERED: 50-99% (verde)
READY: 100% (verde + checkmark)
PLAYING: -% (barra desaparece)
BUFFERING: durante reproducción (amarillo parpadeante)
```

---

### 5.4 Especificación de Sincronización de Play

**Algoritmo:**
```javascript
// Servidor emite 'video-start' con:
{
  videoId: "video123",
  timestamp: 1674216000123,  // Date.now() en servidor
  currentTime: 0,             // segundos
  waitModeType: "normal"
}

// Cliente recibe y calcula:
const clientReceivedTime = Date.now()
const networkDelay = (clientReceivedTime - timestamp) / 1000  // aprox
const seekTime = currentTime + networkDelay

// Cliente ejecuta:
videoElement.currentTime = seekTime
videoElement.play()
```

**Precisión esperada:** ±100-500ms (aceptable para videos)

---

### 5.5 Specification de Hardcore Wait Mode

**Triggers para pausar:**
```
1. Usuario reconecta durante PLAYING
2. Usuario entra en buffering durante PLAYING
3. Usuario con progreso <50% detectado durante PLAYING

Acción: Servidor emite 'pause-all' a todos
Resultado: Todos pausan en posición actual
```

**Triggers para reanudar:**
```
1. Usuario que causó pausa llega a >=50%
2. Usuario se desconecta (después de timeout)

Acción: Servidor calcula posición actual
        Emite 'resume-all' con seekTime
Resultado: Todos reanudan en nuevo seekTime
```

---

### 5.6 Especificación de Caché

**IndexedDB (Cliente):**
```
Almacenamiento: 500MB por usuario
TTL: 5 minutos desde última actividad
Estructura:
  - Store 'videos'
    Key: videoId
    Data: { videoId, sessionId, roomId, blob, addedAt, expiresAt, progress }
  
  - Store 'metadata'
    Key: videoId
    Data: { videoId, title, duration, size, resolution }

Limpieza automática:
  - Si supera 500MB: elimina videos más antiguos (FIFO)
  - Si expira TTL: elimina al reconectar
```

**Redis (Servidor):**
```
video:{videoId} → JSON metadata (TTL 1h)
search:{query} → JSON results (TTL 1h)
room:{roomId}:progress → Hash<sessionId, progress> (TTL 30min)
room:{roomId}:users → List<sessionId> (TTL 30min)
session:{sessionId} → JSON userData (TTL 5min)
```

---

### 5.7 Timeouts y Límites

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Session Timeout | 2 minutos | Sin heartbeat |
| Cache TTL | 5 minutos | IndexedDB |
| API Cache TTL | 1 hora | Redis |
| Room Cleanup | 30 segundos | Si no hay usuarios |
| API Request Timeout | 5 segundos | Per request |
| Video Download Timeout | 5 minutos | Total |
| API Retry Attempts | 3 | Con backoff |
| API Rate Limit | 2 req/s per room, 10 req/s global | Throttled |
| Max Users per Room | 10 | Hard limit |
| Sync Precision | ±500ms | Acceptable |

---

## 🐳 INTEGRACIÓN DOCKER

### 6.1 Estructura Dockerfile Recomendada

```dockerfile
# Frontend (React)
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Backend (Node.js)
FROM node:18-alpine
WORKDIR /app

# Instalar MySQL client para healthcheck
RUN apk add --no-cache mysql-client

# Copiar archivos backend
COPY server/package.json server/package-lock.json ./
RUN npm ci --production

# Copiar frontend build
COPY --from=frontend-build /app/dist ./public

# Copiar código backend
COPY server/ ./

EXPOSE 3000 5000
CMD ["node", "index.js"]
```

---

### 6.2 docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    container_name: yatl-mysql
    environment:
      MYSQL_ROOT_PASSWORD: root_password
      MYSQL_DATABASE: yatl_db
      MYSQL_USER: yatl_user
      MYSQL_PASSWORD: yatl_password
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./server/db_schema.sql:/docker-entrypoint-initdb.d/schema.sql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      timeout: 20s
      retries: 10

  redis:
    image: redis:7-alpine
    container_name: yatl-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      timeout: 3s
      retries: 5

  app:
    build: .
    container_name: yatl-app
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_USER: yatl_user
      DB_PASSWORD: yatl_password
      DB_NAME: yatl_db
      REDIS_URL: redis://redis:6379
      API_PORT: 3000
    ports:
      - "3000:3000"
      - "5000:5000"
    volumes:
      - ./server/logs:/app/logs
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:
```

---

### 6.3 Environment Variables

**`.env` para desarrollo:**
```
NODE_ENV=development
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=yatl_db
REDIS_URL=redis://localhost:6379
API_PORT=3000
SOCKET_PORT=5000
ANIMETHEMES_API=https://api.animethemes.moe/
```

**`.env` para Docker:**
```
NODE_ENV=production
DB_HOST=mysql
DB_USER=yatl_user
DB_PASSWORD=yatl_password
DB_NAME=yatl_db
REDIS_URL=redis://redis:6379
API_PORT=3000
SOCKET_PORT=5000
ANIMETHEMES_API=https://api.animethemes.moe/
```

---

### 6.4 Inicialización de Base de Datos

**script: `init-db.sh`**
```bash
#!/bin/bash
echo "Esperando MySQL..."
while ! mysqladmin ping -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" --silent; do
  sleep 1
done
echo "MySQL disponible!"

echo "Ejecutando migraciones..."
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < ./db_schema.sql

echo "Base de datos lista!"
```

---

## 📋 PLAN DE IMPLEMENTACIÓN SECUENCIAL

### FASE 0: SETUP INICIAL (1-2 días)

#### 0.1 Estructura de carpetas backend
```
server/
├── config/
│   ├── database.js
│   ├── redis.js
│   └── environment.js
├── modules/
│   ├── roomManager.js
│   ├── sessionManager.js
│   ├── throttleManager.js
│   ├── cacheManager.js
│   └── apiHandler.js
├── controllers/
│   └── roomController.js
├── routes/
│   └── api.js
├── socket/
│   └── socket.js
├── utils/
│   ├── logger.js
│   └── validators.js
├── db/
│   ├── schema.sql
│   └── migrations/
├── .env
├── package.json
└── index.js
```

#### 0.2 Dependencias a instalar
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "socket.io": "^4.5.0",
    "mysql2": "^2.3.0",
    "redis": "^4.5.0",
    "axios": "^1.3.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "nodemon": "^2.0.0"
  }
}
```

#### 0.3 Tareas
- [ ] Crear estructura de carpetas
- [ ] Instalar dependencias
- [ ] Configurar MySQL local (XAMPP)
- [ ] Configurar Redis
- [ ] Crear .env
- [ ] Validar conexión a BD

---

### FASE 1: MÓDULOS CORE BACKEND (2-3 días)

#### 1.1 sessionManager.js
- [ ] Generar y validar sessionIds
- [ ] Trackear reconexiones
- [ ] Detectar duplicados (IP + userAgent)
- [ ] Limpiar sesiones expiradas

#### 1.2 roomManager.js
- [ ] CRUD de salas
- [ ] Agregar/remover usuarios
- [ ] Actualizar progreso
- [ ] Calcular "todos listos"
- [ ] Asignar nuevo host

#### 1.3 cacheManager.js
- [ ] Conectar a Redis
- [ ] Métodos get/set/invalidate
- [ ] TTL automático
- [ ] Limpieza periódica

#### 1.4 throttleManager.js
- [ ] Cola de requests
- [ ] Limites por sala + global
- [ ] Deduplicación
- [ ] Reintentos con backoff

#### 1.5 apiHandler.js
- [ ] Integración AnimeThemes API
- [ ] Parseo de respuestas
- [ ] Obtención de URLs
- [ ] Error handling

---

### FASE 2: SOCKET.IO EVENTS (2 días)

#### 2.1 Eventos básicos
- [ ] 'connect' / 'disconnect'
- [ ] 'join-room'
- [ ] 'leave-room'
- [ ] 'progress-update'

#### 2.2 Eventos play
- [ ] 'play'
- [ ] 'force-play'
- [ ] 'video-start'

#### 2.3 Eventos avanzados
- [ ] 'user-buffering-start'
- [ ] 'user-buffering-end'
- [ ] 'pause-all' / 'resume-all'

#### 2.4 Broadcast events
- [ ] 'progress-broadcast'
- [ ] 'all-ready'
- [ ] 'user-joined'
- [ ] 'user-left'

---

### FASE 3: COMPONENTES FRONTEND (3-4 días)

#### 3.1 Componentes visuales
- [ ] WaitModeOverlay.jsx
- [ ] ProgressBarsOverlay.jsx
- [ ] HostControlPanel.jsx
- [ ] LoadingProgress.jsx

#### 3.2 Integración con Room.jsx
- [ ] useSocket hook
- [ ] Estado Zustand actualizado
- [ ] Lógica de transiciones
- [ ] Notificaciones (toast)

#### 3.3 VideoPlayer mejorado
- [ ] Calcular seekTime correcto
- [ ] Sincronización timestamp
- [ ] Detección de buffering
- [ ] Eventos de progreso

#### 3.4 Services cliente
- [ ] CacheManager (IndexedDB)
- [ ] animeApi mejorado
- [ ] sessionStorage management

---

### FASE 4: INTEGRACIÓN DOCKER (1-2 días)

#### 4.1 Dockerización
- [ ] Dockerfile base
- [ ] docker-compose.yml
- [ ] Scripts de inicialización
- [ ] Healthchecks

#### 4.2 Testing en Docker
- [ ] Build local
- [ ] docker-compose up
- [ ] Verificar servicios
- [ ] Logs y debugging

---

### FASE 5: TESTING INTEGRAL (2-3 días)

#### 5.1 Unit tests
- [ ] sessionManager
- [ ] roomManager
- [ ] throttleManager

#### 5.2 Integration tests
- [ ] Flujo completo: join → progress → play → end
- [ ] Reconexión
- [ ] Host change
- [ ] Hardcore mode

#### 5.3 Load testing
- [ ] 10 usuarios simultáneos
- [ ] 3 salas simultáneas
- [ ] API throttling

#### 5.4 Edge cases
- [ ] Desconexión durante play
- [ ] Reconexión rápida
- [ ] Caché lleno
- [ ] API timeout

---

### FASE 6: REFINAMIENTO Y DEPLOY (1-2 días)

#### 6.1 Optimización
- [ ] Compresión de payloads
- [ ] Optimización de queries
- [ ] Caché estratégico

#### 6.2 Monitoring
- [ ] Logs estructurados
- [ ] Métricas básicas
- [ ] Error tracking

#### 6.3 Deploy
- [ ] Docker Hub push
- [ ] Documentación
- [ ] Guía de uso

---

## 🧪 TESTING Y DEBUGGING

### 7.1 Estrategia de Testing

#### Unit Tests
```
roomManager.test.js
├─ addUser()
├─ removeUser()
├─ updateProgress()
├─ getAllReady()
└─ assignNewHost()

sessionManager.test.js
├─ validateOrCreateSession()
├─ isSessionActive()
├─ detectDuplicateSession()
└─ cleanupExpiredSessions()
```

#### Integration Tests
```
wait-mode-flow.test.js
├─ Usuario entra a sala
├─ Progreso se actualiza
├─ "Todos listos" se detecta
├─ Host presiona PLAY
├─ Sincronización ocurre
└─ Video termina

reconnection-flow.test.js
├─ Usuario se desconecta
├─ Reconecta dentro 2 min
├─ Estado se recupera
└─ Caché se reutiliza
```

---

### 7.2 Debugging Tools

**Backend:**
```javascript
// Logger centralizado
logger.info('User joined', { roomId, sessionId })
logger.warn('Progress update late', { delay })
logger.error('API timeout', { endpoint, error })

// Metrics
metrics.incrementCounter('users_joined')
metrics.gauge('active_rooms', activeRoomsCount)
metrics.timer('api_request_time', duration)
```

**Frontend:**
```javascript
// Socket debugging
if (DEBUG) socket.onAny((event, ...args) => {
  console.log('SOCKET EVENT:', event, args)
})

// IndexedDB logging
cacheManager.saveVideo = async (videoId, blob) => {
  console.log('Saving to IndexedDB:', videoId, blob.size)
  // ...
}
```

---

### 7.3 Monitoreo en Producción

**Métricas a trackear:**
- Usuarios activos por sala
- Promedio de progreso de carga
- Latencia de eventos Socket
- Errores de API (count + rate)
- Tamaño de caché por usuario
- Tiempo de sincronización

**Alertas a configurar:**
- Sala sin usuarios >30 seg
- API rate limit excedido
- Socket desconexiones >5% usuarios
- Caché full (>400MB/usuario)

---

## 📊 MATRIZ DE DECISIONES

### Decisión 1: ¿Dónde se almacena caché de videos?
| Opción | Ventajas | Desventajas |
|--------|----------|------------|
| **IndexedDB (Cliente)** ✅ | No carga server, CORS OK, rapido | Limitado por browser, se pierde si caché clara |
| Redis (Servidor) | Compartido entre usuarios | Consume RAM, dependencia externa |
| Disk (Servidor) | Persistencia | Lento, I/O bound, escalabilidad |

**Decisión:** IndexedDB en cliente

---

### Decisión 2: ¿sessionId por usuario o por usuario+sala?
| Opción | Ventajas | Desventajas |
|--------|----------|------------|
| **Global (usuario)** ✅ | Trackeo entre salas, caché compartible | Complejidad en multi-sala |
| Per-sala (usuario+sala) | Aislamiento por sala | Más sessionIds, tracking fragmentado |

**Decisión:** sessionId global + roomSessionId local

---

### Decisión 3: ¿Rate limiting con Queue o Weighted slots?
| Opción | Ventajas | Desventajas |
|--------|----------|------------|
| **Queue (FIFO)** ✅ | Simple, predecible, fair | Latencia variable |
| Weighted (por usuarios) | Proporcional | Más complejo |

**Decisión:** Queue con priority queue (WAIT MODE PLAYING > normal)

---

### Decisión 4: ¿Descargar en cliente o servidor?
| Opción | Ventajas | Desventajas |
|--------|----------|------------|
| **Cliente (directo CDN)** ✅ | No carga server, CORS OK, paralelo | Depende conexión cliente |
| Servidor proxy | Control centralizado, deduplicación | Carga server, latencia |

**Decisión:** Cliente directo a CDN

---

### Decisión 5: ¿Hardcore mode por defecto o opt-in?
| Opción | Ventajas | Desventajas |
|--------|----------|------------|
| **Opt-in (host elige)** ✅ | Flexibilidad, experiencia variable | Más complejo |
| Siempre | Garantía de sync | Menos flexible |

**Decisión:** Host elige al crear sala

---

## 🎯 PRÓXIMOS PASOS

1. ✅ Plan arquitectónico completado
2. ⏭️ Implementar FASE 0 (Setup)
3. ⏭️ Implementar FASE 1 (Módulos core)
4. ⏭️ Implementar FASE 2 (Socket.io)
5. ⏭️ Implementar FASE 3 (Frontend)
6. ⏭️ Dockerizar (FASE 4)
7. ⏭️ Testing (FASE 5)
8. ⏭️ Deploy (FASE 6)

---

## 📚 REFERENCIAS

- AnimeThemes API Docs: https://api-docs.animethemes.moe/intro/
- Socket.io Documentation: https://socket.io/docs/
- Zustand: https://github.com/pmndrs/zustand
- IndexedDB: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Docker Compose: https://docs.docker.com/compose/

---

**Documento completado: Enero 2026**  
**Estado:** Listo para implementación
