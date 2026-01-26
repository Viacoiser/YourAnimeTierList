const API_URL = 'http://localhost:3003/api';

// Helper para headers con token
const getHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
};

// Función para fetch con timeout
const fetchWithTimeout = async (url, options = {}, timeout = 5000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const api = {
    // Auth
    register: async (username, password) => {
        try {
            const res = await fetchWithTimeout(`${API_URL}/register`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                const error = await res.json();
                // Mejorar mensajes de error
                if (res.status === 409) {
                    throw new Error('Este usuario ya existe. Intenta con otro nombre.');
                }
                throw new Error(error.message || 'Error en registro');
            }
            return res.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('El servidor no responde. Verifica que esté encendido.');
            }
            if (error.message === 'Failed to fetch') {
                throw new Error('No se puede conectar al servidor. Verifica que esté corriendo en el puerto 3003.');
            }
            throw error;
        }
    },

    login: async (username, password) => {
        try {
            const res = await fetchWithTimeout(`${API_URL}/login`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                const error = await res.json();
                // Mejorar mensajes de error
                if (res.status === 401) {
                    throw new Error('Usuario o contraseña incorrectos');
                }
                throw new Error(error.message || 'Error en login');
            }
            const data = await res.json();
            localStorage.setItem('token', data.token);
            return data; // { token, user }
        } catch (error) {
            // Mejorar mensajes de error de red
            if (error.name === 'AbortError') {
                throw new Error('El servidor no responde. Verifica que esté encendido.');
            }
            if (error.message === 'Failed to fetch') {
                throw new Error('No se puede conectar al servidor. Verifica que esté corriendo en el puerto 3003.');
            }
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
    },

    // Ratings
    saveRating: async (videoId, score, comment, videoData) => {
        const res = await fetchWithTimeout(`${API_URL}/ratings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ videoId, score, comment, videoData }),
        });
        if (!res.ok) throw new Error('Error guardando puntuación');
        return res.json();
    },

    // User Profile
    getUserProfile: async (username) => {
        const res = await fetchWithTimeout(`${API_URL}/users/${username}`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Usuario no encontrado');
        return res.json();
    },

    getFriends: async (userId) => {
        const res = await fetchWithTimeout(`${API_URL}/users/${userId}/friends`, {
            headers: getHeaders(),
        });
        if (!res.ok) return []; // Si falla, retornamos array vacío
        return res.json();
    },

    // Favorites
    addFavorite: async (videoId, videoData) => {
        const res = await fetchWithTimeout(`${API_URL}/favorites`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ videoId, videoData }),
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.details || errData.message || 'Error al agregar favorito');
        }
        return res.json();
    },

    removeFavorite: async (videoId) => {
        const res = await fetchWithTimeout(`${API_URL}/favorites/${videoId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error al eliminar favorito');
        return res.json();
    },

    checkFavorite: async (videoId) => {
        const res = await fetchWithTimeout(`${API_URL}/favorites/check/${videoId}`, {
            headers: getHeaders(),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return data.isFavorite;
    },

    getUserFavorites: async (username) => {
        const res = await fetchWithTimeout(`${API_URL}/users/${username}/favorites`, {
            headers: getHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
    },

    // Friends System
    searchUsers: async (query) => {
        const res = await fetchWithTimeout(`${API_URL}/users/search/${encodeURIComponent(query)}`, {
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error buscando usuarios');
        return res.json();
    },

    getFriends: async (userId) => {
        const res = await fetchWithTimeout(`${API_URL}/users/${userId}/friends`, {
            headers: getHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
    },

    sendFriendRequest: async (friendId) => {
        const res = await fetchWithTimeout(`${API_URL}/friends/request`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ friendId }),
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Error enviando solicitud');
        }
        return res.json();
    },

    getPendingRequests: async () => {
        const res = await fetchWithTimeout(`${API_URL}/friends/pending`, {
            headers: getHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
    },

    acceptFriendRequest: async (requestId) => {
        const res = await fetchWithTimeout(`${API_URL}/friends/accept/${requestId}`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error aceptando solicitud');
        return res.json();
    },

    rejectFriendRequest: async (requestId) => {
        const res = await fetchWithTimeout(`${API_URL}/friends/reject/${requestId}`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error rechazando solicitud');
        return res.json();
    },

    removeFriend: async (friendId) => {
        const res = await fetchWithTimeout(`${API_URL}/friends/${friendId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error eliminando amigo');
        return res.json();
    },

    // Messaging System
    sendMessage: async (receiverId, messageType, content, roomCode = null, roomName = null) => {
        const res = await fetchWithTimeout(`${API_URL}/messages`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ receiverId, messageType, content, roomCode, roomName }),
        });
        if (!res.ok) throw new Error('Error enviando mensaje');
        return res.json();
    },

    getConversation: async (friendId) => {
        const res = await fetchWithTimeout(`${API_URL}/messages/${friendId}`, {
            headers: getHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
    },

    markMessageAsRead: async (messageId) => {
        const res = await fetchWithTimeout(`${API_URL}/messages/${messageId}/read`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Error marcando mensaje');
        return res.json();
    },

    getUnreadCount: async () => {
        const res = await fetchWithTimeout(`${API_URL}/messages/unread/count`, {
            headers: getHeaders(),
        });
        if (!res.ok) return { unreadCount: 0 };
        return res.json();
    },

    getConversations: async () => {
        const res = await fetchWithTimeout(`${API_URL}/messages/conversations`, {
            headers: getHeaders(),
        });
        if (!res.ok) return [];
        return res.json();
    }
};
