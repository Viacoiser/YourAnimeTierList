require('dotenv').config();
const express = require('express');
const http = require('http');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const setupSocket = require('./socket');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- CACHE SETUP ---
const CacheManager = require('./cache-manager');
const CACHE_DIR = path.join(__dirname, 'video_cache');
const cacheManager = new CacheManager(CACHE_DIR);

// --- SISTEMA DE LOGS (Guardar en archivo) ---
const logStream = fs.createWriteStream(path.join(__dirname, 'server_logs.txt'), { flags: 'a' });

function fileLog(type, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
    logStream.write(`[${timestamp}] [${type}] ${message}\n`);
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => { originalLog(...args); fileLog('INFO', args); };
console.error = (...args) => { originalError(...args); fileLog('ERROR', args); };
console.warn = (...args) => { originalWarn(...args); fileLog('WARN', args); };

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

const PORT = process.env.PORT || 3003;

// Configuración de la base de datos
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'rootpassword',
    database: process.env.DB_NAME || 'your_anime_tierlist',
};

// Función para reconectar a la base de datos si se pierde la conexión
let db;
function handleDisconnect() {
    db = mysql.createConnection(dbConfig);

    db.connect(function (err) {
        if (err) {
            console.log('Error conectando a la base de datos:', err);
            setTimeout(handleDisconnect, 2000);
        } else {
            console.log('Conectado a la base de datos MySQL');
        }
    });

    db.on('error', function (err) {
        console.log('Error de base de datos', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect();
        } else {
            throw err;
        }
    });
}

handleDisconnect();

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'No proporcionaste token de autenticación' });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
};

/* --- RUTAS --- */

// Registro
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=dc2626&color=fff`;

        const query = 'INSERT INTO users (username, password, avatar_url) VALUES (?, ?, ?)';
        db.query(query, [username, hashedPassword, avatarUrl], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({ message: 'El usuario ya existe' });
                }
                return res.status(500).json({ message: 'Error al registrar usuario', error: err });
            }
            res.status(201).json({ message: 'Usuario registrado exitosamente' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Error en el servidor' });
        if (results.length === 0) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });

        const user = results[0];

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'secret');
            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar_url
                }
            });
        } else {
            res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }
    });
});

// Guardar Puntuación
app.post('/api/ratings', authenticateToken, (req, res) => {
    const { videoId, score, comment, videoData } = req.body;
    const userId = req.user.id;

    // Primero intentamos insertar o actualizar (ON DUPLICATE KEY UPDATE)
    const query = `
        INSERT INTO ratings (user_id, video_id, score, comment, anime_name, theme_name, theme_type, song_title, artist)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE score = VALUES(score), comment = VALUES(comment)
    `;

    const values = [
        userId, videoId, score, comment,
        videoData.animeName, videoData.themeName, videoData.themeType, videoData.songTitle, videoData.artist
    ];

    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ message: 'Error al guardar puntuación', error: err });
        res.json({ message: 'Puntuación guardada' });
    });
});

// Obtener perfil y puntuaciones
app.get('/api/users/:username', (req, res) => {
    const username = req.params.username;

    const userQuery = 'SELECT id, username, avatar_url, created_at FROM users WHERE username = ?';
    db.query(userQuery, [username], (err, userResults) => {
        if (err) return res.status(500).json({ message: 'Error en el servidor' });
        if (userResults.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        const user = userResults[0];

        const ratingsQuery = 'SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC';
        db.query(ratingsQuery, [user.id], (err, ratingsResults) => {
            if (err) return res.status(500).json({ message: 'Error obteniendo puntuaciones' });

            res.json({
                user,
                ratings: ratingsResults
            });
        });
    });
});

// --- FAVORITOS ---

// Agregar favorito
app.post('/api/favorites', authenticateToken, (req, res) => {
    const { videoId, videoData } = req.body;
    const userId = req.user.id;

    const query = `
        INSERT INTO favorites (user_id, video_id, anime_name, theme_name, theme_type, song_title, artist)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP
    `;

    // Aseguramos que videoData tenga todos los campos
    const values = [
        userId, videoId,
        videoData.animeName || '', videoData.themeName || '', videoData.themeType || '',
        videoData.songTitle || '', videoData.artist || ''
    ];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error SQL en POST /api/favorites:', err);
            return res.status(500).json({ message: 'Error al agregar favorito', error: err.code, details: err.sqlMessage });
        }
        res.json({ message: 'Agregado a favoritos' });
    });
});

// Eliminar favorito
app.delete('/api/favorites/:videoId', authenticateToken, (req, res) => {
    const videoId = req.params.videoId;
    const userId = req.user.id;

    const query = 'DELETE FROM favorites WHERE user_id = ? AND video_id = ?';
    db.query(query, [userId, videoId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error al eliminar favorito', error: err });
        res.json({ message: 'Removido de favoritos' });
    });
});

// Verificar si es favorito
app.get('/api/favorites/check/:videoId', authenticateToken, (req, res) => {
    const videoId = req.params.videoId;
    const userId = req.user.id;

    const query = 'SELECT COUNT(*) as count FROM favorites WHERE user_id = ? AND video_id = ?';
    db.query(query, [userId, videoId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error checking favorite' });
        res.json({ isFavorite: results[0].count > 0 });
    });
});

// Obtener favoritos de un usuario
app.get('/api/users/:username/favorites', (req, res) => {
    const username = req.params.username;

    // Primero obtenemos el ID del usuario
    db.query('SELECT id FROM users WHERE username = ?', [username], (err, users) => {
        if (err || users.length === 0) return res.status(404).json({ message: 'User not found' });

        const userId = users[0].id;
        const query = 'SELECT * FROM favorites WHERE user_id = ? ORDER BY created_at DESC';

        db.query(query, [userId], (err, results) => {
            if (err) return res.status(500).json({ message: 'Error getting favorites' });
            res.json(results);
        });
    });
});

// Amigos
app.get('/api/users/:userId/friends', (req, res) => {
    const userId = req.params.userId;
    const query = `
        SELECT u.id, u.username, u.avatar_url, f.status 
        FROM friends f
        JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id)
        WHERE (f.user_id = ? OR f.friend_id = ?) 
        AND u.id != ? 
        AND f.status = 'accepted'
    `;

    db.query(query, [userId, userId, userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error obteniendo amigos', error: err });
        res.json(results);
    });
});

// Buscar usuarios
app.get('/api/users/search/:query', authenticateToken, (req, res) => {
    const searchQuery = req.params.query;
    const currentUserId = req.user.id;

    console.log('Search query:', searchQuery, 'Current user:', currentUserId);

    if (!searchQuery || searchQuery.length < 2) {
        return res.status(400).json({ message: 'La búsqueda debe tener al menos 2 caracteres' });
    }

    const query = `
        SELECT id, username, avatar_url, created_at
        FROM users
        WHERE LOWER(username) = LOWER(?) AND id != ?
        LIMIT 20
    `;

    db.query(query, [searchQuery, currentUserId], (err, results) => {
        if (err) {
            console.error('Error searching users:', err);
            return res.status(500).json({ message: 'Error buscando usuarios', error: err });
        }
        console.log('Search results:', results.length, 'users found');
        res.json(results);
    });
});

// Enviar solicitud de amistad
app.post('/api/friends/request', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { friendId } = req.body;

    if (!friendId) {
        return res.status(400).json({ message: 'friendId es requerido' });
    }

    if (userId === friendId) {
        return res.status(400).json({ message: 'No puedes enviarte solicitud a ti mismo' });
    }

    // Verificar si ya existe una solicitud
    const checkQuery = `
        SELECT * FROM friends 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `;

    db.query(checkQuery, [userId, friendId, friendId, userId], (err, existing) => {
        if (err) return res.status(500).json({ message: 'Error verificando solicitud', error: err });

        if (existing.length > 0) {
            return res.status(409).json({ message: 'Ya existe una solicitud de amistad' });
        }

        // Crear solicitud
        const insertQuery = 'INSERT INTO friends (user_id, friend_id, status) VALUES (?, ?, ?)';
        db.query(insertQuery, [userId, friendId, 'pending'], (err, result) => {
            if (err) return res.status(500).json({ message: 'Error enviando solicitud', error: err });
            res.json({ message: 'Solicitud enviada' });
        });
    });
});

// Obtener solicitudes pendientes
app.get('/api/friends/pending', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT f.id as request_id, u.id, u.username, u.avatar_url, f.created_at
        FROM friends f
        JOIN users u ON f.user_id = u.id
        WHERE f.friend_id = ? AND f.status = 'pending'
        ORDER BY f.created_at DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error obteniendo solicitudes', error: err });
        res.json(results);
    });
});

// Aceptar solicitud de amistad
app.post('/api/friends/accept/:requestId', authenticateToken, (req, res) => {
    const requestId = req.params.requestId;
    const userId = req.user.id;

    // Verificar que la solicitud sea para este usuario
    const checkQuery = 'SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?';

    db.query(checkQuery, [requestId, userId, 'pending'], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error verificando solicitud', error: err });

        if (results.length === 0) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // Aceptar solicitud
        const updateQuery = 'UPDATE friends SET status = ? WHERE id = ?';
        db.query(updateQuery, ['accepted', requestId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Error aceptando solicitud', error: err });
            res.json({ message: 'Solicitud aceptada' });
        });
    });
});

// Rechazar solicitud de amistad
app.post('/api/friends/reject/:requestId', authenticateToken, (req, res) => {
    const requestId = req.params.requestId;
    const userId = req.user.id;

    // Verificar que la solicitud sea para este usuario
    const checkQuery = 'SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?';

    db.query(checkQuery, [requestId, userId, 'pending'], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error verificando solicitud', error: err });

        if (results.length === 0) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // Eliminar solicitud
        const deleteQuery = 'DELETE FROM friends WHERE id = ?';
        db.query(deleteQuery, [requestId], (err, result) => {
            if (err) return res.status(500).json({ message: 'Error rechazando solicitud', error: err });
            res.json({ message: 'Solicitud rechazada' });
        });
    });
});

// Eliminar amigo
app.delete('/api/friends/:friendId', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    const deleteQuery = `
        DELETE FROM friends 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `;

    db.query(deleteQuery, [userId, friendId, friendId, userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error eliminando amigo', error: err });
        res.json({ message: 'Amigo eliminado' });
    });
});

// ========== MENSAJERÍA ==========

// Enviar mensaje
app.post('/api/messages', authenticateToken, (req, res) => {
    const senderId = req.user.id;
    const { receiverId, messageType, content, roomCode, roomName } = req.body;

    if (!receiverId) {
        return res.status(400).json({ message: 'receiverId es requerido' });
    }

    // Verificar que sean amigos
    const friendCheckQuery = `
        SELECT * FROM friends 
        WHERE ((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?))
        AND status = 'accepted'
    `;

    db.query(friendCheckQuery, [senderId, receiverId, receiverId, senderId], (err, friends) => {
        if (err) return res.status(500).json({ message: 'Error verificando amistad', error: err });

        if (friends.length === 0) {
            return res.status(403).json({ message: 'Solo puedes enviar mensajes a tus amigos' });
        }

        // Calcular expiración
        let expiresAt = null;
        if (messageType === 'room_invitation') {
            // Invitaciones expiran en 1 minuto
            expiresAt = new Date(Date.now() + 60 * 1000);
        } else {
            // Mensajes de texto expiran en 24 horas (auto-limpieza)
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        }

        const insertQuery = `
            INSERT INTO messages (sender_id, receiver_id, message_type, content, room_code, room_name, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(insertQuery, [senderId, receiverId, messageType, content, roomCode, roomName, expiresAt], (err, result) => {
            if (err) return res.status(500).json({ message: 'Error enviando mensaje', error: err });
            res.json({
                message: 'Mensaje enviado',
                messageId: result.insertId
            });
        });
    });
});

// Obtener conversación con un amigo
app.get('/api/messages/:friendId', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    const query = `
        SELECT m.*, 
               sender.username as sender_username,
               sender.avatar_url as sender_avatar,
               receiver.username as receiver_username,
               receiver.avatar_url as receiver_avatar
        FROM messages m
        JOIN users sender ON m.sender_id = sender.id
        JOIN users receiver ON m.receiver_id = receiver.id
        WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
        AND m.expires_at > NOW()
        ORDER BY m.created_at ASC
    `;

    db.query(query, [userId, friendId, friendId, userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error obteniendo mensajes', error: err });
        res.json(results);
    });
});

// Marcar mensaje como leído
app.put('/api/messages/:messageId/read', authenticateToken, (req, res) => {
    const messageId = req.params.messageId;
    const userId = req.user.id;

    const query = 'UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?';

    db.query(query, [messageId, userId], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error marcando mensaje', error: err });
        res.json({ message: 'Mensaje marcado como leído' });
    });
});

// Obtener contador de mensajes no leídos
app.get('/api/messages/unread/count', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT COUNT(*) as unread_count
        FROM messages
        WHERE receiver_id = ? AND is_read = FALSE AND expires_at > NOW()
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error obteniendo contador', error: err });
        res.json({ unreadCount: results[0].unread_count });
    });
});

// Obtener lista de conversaciones (últimos mensajes con cada amigo)
app.get('/api/messages/conversations', authenticateToken, (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            CASE 
                WHEN m.sender_id = ? THEN m.receiver_id 
                ELSE m.sender_id 
            END as friend_id,
            u.username as friend_username,
            u.avatar_url as friend_avatar,
            m.content as last_message,
            m.message_type as last_message_type,
            m.created_at as last_message_time,
            m.is_read,
            (SELECT COUNT(*) FROM messages 
             WHERE receiver_id = ? AND sender_id = friend_id AND is_read = FALSE AND expires_at > NOW()
            ) as unread_count
        FROM messages m
        JOIN users u ON u.id = CASE 
            WHEN m.sender_id = ? THEN m.receiver_id 
            ELSE m.sender_id 
        END
        WHERE (m.sender_id = ? OR m.receiver_id = ?)
        AND m.expires_at > NOW()
        AND m.id IN (
            SELECT MAX(id) 
            FROM messages 
            WHERE (sender_id = ? OR receiver_id = ?)
            AND expires_at > NOW()
            GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
        )
        ORDER BY m.created_at DESC
    `;

    db.query(query, [userId, userId, userId, userId, userId, userId, userId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error obteniendo conversaciones', error: err });
        res.json(results);
    });
});

// Limpiar mensajes expirados (ejecutar periódicamente)
app.delete('/api/messages/cleanup', (req, res) => {
    const query = 'DELETE FROM messages WHERE expires_at < NOW()';

    db.query(query, (err, result) => {
        if (err) return res.status(500).json({ message: 'Error limpiando mensajes', error: err });
        res.json({
            message: 'Mensajes expirados eliminados',
            deletedCount: result.affectedRows
        });
    });
});

// Auto-limpieza cada hora
setInterval(() => {
    db.query('DELETE FROM messages WHERE expires_at < NOW()', (err, result) => {
        if (err) {
            console.error('Error en auto-limpieza de mensajes:', err);
        } else {
            console.log(`Auto-limpieza: ${result.affectedRows} mensajes eliminados`);
        }
    });
}, 60 * 60 * 1000); // Cada hora



// --- PROXY PARA ANIMETHEMES (Evitar CORS) ---
app.get(/^\/api\/proxy\/(.*)/, async (req, res) => {
    try {
        const endpoint = req.params[0];
        const targetUrl = `https://api.animethemes.moe/${endpoint}`;

        console.log(`[PROXY API] Forwarding to: ${targetUrl}`);

        const response = await axios.get(targetUrl, {
            params: req.query,
            headers: {
                'User-Agent': 'YourAnimeTierList/1.0',
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Proxy Error:', error.message);
        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ message: 'Error en proxy', error: error.message });
    }
});

// --- PROXY PARA VIDEO (Preloading + Caching) ---
// Global maps to track downloads
const activeDownloads = new Set(); // Set<fileHash>

app.get('/api/video-proxy', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    // Generar nombre de archivo único para caché (Hash MD5 de la URL)
    const fileHash = crypto.createHash('md5').update(videoUrl).digest('hex');
    const tempPath = path.join(CACHE_DIR, `${fileHash}.part`);
    const finalPath = path.join(CACHE_DIR, `${fileHash}.mp4`);

    // Helper para servir archivo
    const serveFile = (filePath, resToServe, reqToServe) => {
        if (!fs.existsSync(filePath)) {
            return resToServe.status(404).send('File missing');
        }

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;
        const range = reqToServe.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            if (start >= fileSize) {
                resToServe.status(416).send('Requested range not satisfiable');
                return;
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            };
            resToServe.writeHead(206, head);
            file.pipe(resToServe);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            resToServe.writeHead(200, head);
            fs.createReadStream(filePath).pipe(resToServe);
        }
    };

    // 1. Check if cached (Fast Path)
    if (cacheManager.get(fileHash) || fs.existsSync(finalPath)) {
        if (!cacheManager.get(fileHash)) cacheManager.set(fileHash);
        return serveFile(finalPath, res, req);
    }

    // 2. Cache Miss - Download & Stream
    // Determinar si somos el "Writer" (el primero en llegar)
    // Si ya hay alguien descargando (activeDownloads has hash), nosotros SOLO descargamos (no escribimos)
    // Esto cumple: "Los demás si lo piden también descargan" (Concurrent Download)
    const isWriter = !activeDownloads.has(fileHash);

    if (isWriter) {
        activeDownloads.add(fileHash);
        console.log(`[CACHE MISS] Iniciando descarga (WRITER): ${videoUrl}`);
    } else {
        console.log(`[CACHE MISS] Iniciando descarga concurrente (NO WRITER): ${videoUrl}`);
    }

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            }
        });

        // Copiar headers
        if (response.headers['content-type']) res.set('Content-Type', response.headers['content-type']);
        if (response.headers['content-length']) res.set('Content-Length', response.headers['content-length']);

        // Pipe DIRECTO al usuario (Stream inmediato, CERO espera)
        response.data.pipe(res);

        // Si somos Writer, guardamos copia en disco
        if (isWriter) {
            const writer = fs.createWriteStream(tempPath);
            response.data.pipe(writer);

            writer.on('finish', () => {
                console.log(`[CACHE SAVED] Descarga finalizada: ${videoUrl}`);
                fs.renameSync(tempPath, finalPath);
                cacheManager.set(fileHash);
                activeDownloads.delete(fileHash);
            });

            writer.on('error', (err) => {
                console.error('Error escribiendo caché:', err);
                activeDownloads.delete(fileHash);
                try { fs.unlinkSync(tempPath); } catch (e) { }
            });
        }

    } catch (error) {
        console.error('Video Proxy Error:', error.message);
        if (isWriter) {
            activeDownloads.delete(fileHash);
            if (fs.existsSync(tempPath)) try { fs.unlinkSync(tempPath); } catch (e) { }
        }

        if (error.response && [403, 404, 503].includes(error.response.status)) {
            return res.status(error.response.status).send('Video error');
        }
        // No enviamos 500 si ya se enviaron headers (pipe)
        if (!res.headersSent) res.status(500).send('Error proxying video');
    }
});

// Health check
app.get('/', (req, res) => {
    res.send('YourAnimeTierList API Running');
});

// Crear servidor HTTP y configurar Socket.io
const server = http.createServer(app);
const io = setupSocket(server);

server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    console.log(`🔌 WebSocket habilitado`);
});
