import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import FriendsManager from './FriendsManager';

function Profile() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuthStore();
    const { openChat } = useChatStore();

    const [profileUser, setProfileUser] = useState(null);
    const [ratings, setRatings] = useState([]);
    const [favorites, setFavorites] = useState([]); // Aún no implementado en backend API para leer, usaremos placeholder o agregaremos endpoint luego si es crítico
    const [friends, setFriends] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ratings');
    const [showFriendsManager, setShowFriendsManager] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            // Determinar ID del usuario a ver (si no hay param, usamos el usuario logueado)
            const targetUserId = userId || currentUser?.id;

            // Si no hay ID ni usuario logueado, volver a home
            if (!targetUserId) {
                navigate('/');
                return;
            }

            // Si intentamos ver "mi perfil" sin ID en la url, redirigir a la URL con ID para consistencia (opcional, pero buena práctica)
            // Pero aquí simplemente cargaremos los datos

            try {
                setLoading(true);
                // Obtener perfil (username) - La API actual busca por username, necesitamos ajustar o buscar por ID
                // Como la API busca por username, y aquí tenemos ID, hay una discrepancia.
                // Asumiremos que si es currentUser, usamos su username. Si es otro, necesitamos su username.
                // FIX: La ruta actual es /profile/:userId. Si userId es numérico, la API backend espera username.
                // Haremos un pequeño "hack": si es currentUser, usamos su username.
                // Si no, podríamos fallar si la API solo acepta username.
                // Idealmente, la API debería aceptar ID o Username.
                // Por ahora, intentaremos cargar usando el nombre de usuario si lo tenemos a mano.

                let targetUsername;

                if (currentUser && (!userId || userId.toString() === currentUser.id.toString())) {
                    targetUsername = currentUser.username || currentUser.displayName; // AuthStore usa displayName mapeado
                } else {
                    // Si visitamos un perfil ajeno por ID, necesitamos resolver ese ID a username primero
                    // O cambiar la API para aceptar IDs.
                    // Dado que no tenemos un endpoint "getUserById", asumiremos que userId en la URL ES EL USERNAME
                    // Esto simplifica todo: la ruta pasa a ser /profile/:username
                    targetUsername = userId;
                }

                if (!targetUsername) {
                    navigate('/');
                    return;
                }

                const data = await api.getUserProfile(targetUsername);
                const friendsData = await api.getFriends(data.user.id);
                const favoritesData = await api.getUserFavorites(targetUsername);

                setProfileUser(data.user);
                setRatings(data.ratings);
                setFriends(friendsData);
                setFavorites(favoritesData);

                // Si es mi perfil, cargar solicitudes pendientes
                if (currentUser && (!userId || userId.toString() === currentUser.id.toString())) {
                    try {
                        const pendingData = await api.getPendingRequests();
                        setPendingRequests(pendingData);
                    } catch (error) {
                        console.error('Error loading pending requests:', error);
                    }
                }

                // Calcular stats

            } catch (error) {
                console.error(error);
                // Si falla, tal vez el usuario no existe
                navigate('/');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId, currentUser, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-premium-black-200 border-t-premium-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-neutral-400 text-lg">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    if (!profileUser) return null;

    const isOwnProfile = currentUser?.id === profileUser.id;

    // Calcular estadísticas simples
    const scores = ratings.map(r => r.score);
    const averageScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : '0.00';
    const highestScore = scores.length ? Math.max(...scores) : '-';

    return (
        <div className="min-h-screen p-6 pb-24 bg-gradient-to-br from-black via-premium-black-400 to-premium-black-300">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 glass-dark text-neutral-200 rounded-lg hover:bg-premium-red-600 transition-colors flex items-center gap-2"
                >
                    <span>←</span> Volver al inicio
                </button>
            </div>

            {/* Profile Card */}
            <div className="max-w-6xl mx-auto glass-dark rounded-2xl p-8 mb-6 border border-premium-red-600/20">
                <div className="flex flex-col md:flex-row items-center gap-8 mb-8">
                    <img
                        src={profileUser.avatar_url || profileUser.avatar}
                        alt={profileUser.username}
                        className="w-40 h-40 rounded-full border-4 border-premium-red-600 shadow-glow-red"
                    />
                    <div className="text-center md:text-left flex-1">
                        <h1 className="text-5xl font-display font-bold text-gradient-red mb-2">
                            {profileUser.username}
                        </h1>
                        <p className="text-neutral-400 text-lg">
                            Miembro desde {new Date(profileUser.created_at || profileUser.createdAt).toLocaleDateString()}
                        </p>
                        {isOwnProfile && (
                            <div className="mt-4 flex gap-3 justify-center md:justify-start">
                                <span className="inline-block px-4 py-1 bg-premium-red-600/20 text-premium-red-400 text-sm font-semibold rounded-full border border-premium-red-600/30">
                                    Tu Perfil
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stats Box */}
                    <div className="grid grid-cols-3 gap-6 text-center bg-black/40 p-6 rounded-2xl border border-white/5">
                        <div>
                            <div className="text-3xl font-bold text-white mb-1">{ratings.length}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest">Puntuaciones</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-white mb-1">{favorites.length}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest">Favoritos</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-premium-red-500 mb-1">{averageScore}</div>
                            <div className="text-xs text-neutral-500 uppercase tracking-widest">Promedio</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="max-w-6xl mx-auto glass-dark rounded-2xl p-8 min-h-[500px]">
                <div className="flex gap-6 mb-8 border-b border-premium-black-200 overflow-x-auto">
                    {['ratings', 'favorites', 'friends'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 px-2 font-bold text-lg transition-all relative whitespace-nowrap ${activeTab === tab
                                ? 'text-premium-red-500'
                                : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            {tab === 'ratings' && '📊 Puntuaciones'}
                            {tab === 'favorites' && '⭐ Favoritos'}
                            {tab === 'friends' && '👥 Amigos'}

                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-premium-red-600 rounded-t-full shadow-glow-red"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Ratings Tab */}
                {activeTab === 'ratings' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                            <span>Historial de Puntuaciones</span>
                            <span className="text-sm bg-premium-black-200 text-neutral-400 px-3 py-1 rounded-full font-normal">{ratings.length} videos</span>
                        </h2>

                        {ratings.length === 0 ? (
                            <div className="text-center py-20 text-neutral-500 bg-black/20 rounded-2xl border border-dashed border-white/10">
                                <div className="text-7xl mb-6 opacity-50">📊</div>
                                <p className="text-xl font-medium mb-2">Aún no hay puntuaciones</p>
                                <p className="text-sm">¡Únete a una sala y comienza a puntuar!</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {ratings.map((rating) => (
                                    <div key={rating.id} className="card-premium flex flex-col sm:flex-row items-center gap-6 p-6 group hover:border-premium-red-600/40 transition-all">
                                        <div className="relative">
                                            <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-premium-red-500 to-premium-red-700 w-24 text-center">
                                                {rating.score}
                                            </div>
                                            <div className="text-xs text-center text-neutral-500 font-bold mt-1 uppercase tracking-widest">Puntos</div>
                                        </div>

                                        <div className="h-12 w-[1px] bg-white/10 hidden sm:block"></div>

                                        <div className="flex-1 text-center sm:text-left w-full">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                                                <h3 className="text-xl font-bold text-white group-hover:text-premium-red-400 transition-colors">
                                                    {rating.anime_name}
                                                </h3>
                                                <span className="text-xs text-neutral-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                                                    {new Date(rating.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-premium-red-200 font-medium mb-1">
                                                {rating.theme_type} {rating.theme_name} <span className="text-neutral-500 mx-2">•</span> {rating.song_title}
                                            </p>
                                            <p className="text-neutral-500 text-sm">{rating.artist}</p>
                                            {rating.comment && (
                                                <div className="mt-4 bg-white/5 p-4 rounded-xl border border-white/5">
                                                    <p className="text-neutral-300 italic">"{rating.comment}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Favorites Tab */}
                {activeTab === 'favorites' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                            <span>Favoritos</span>
                            <span className="text-sm bg-premium-black-200 text-neutral-400 px-3 py-1 rounded-full font-normal">{favorites.length} videos</span>
                        </h2>

                        {favorites.length === 0 ? (
                            <div className="text-center py-20 text-neutral-500 bg-black/20 rounded-2xl border border-dashed border-white/10">
                                <div className="text-7xl mb-6 opacity-50">⭐</div>
                                <p className="text-xl font-medium mb-2">No tienes favoritos aún</p>
                                <p className="text-sm">¡Agrega videos a favoritos desde la sala!</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {favorites.map((fav) => (
                                    <div key={fav.id} className="card-premium flex flex-col sm:flex-row items-center gap-6 p-6 group hover:border-yellow-500/40 transition-all border-l-4 border-l-yellow-500/50">
                                        <div className="text-4xl text-yellow-500 group-hover:scale-110 transition-transform">
                                            ⭐
                                        </div>

                                        <div className="h-12 w-[1px] bg-white/10 hidden sm:block"></div>

                                        <div className="flex-1 text-center sm:text-left w-full">
                                            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-2">
                                                <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors">
                                                    {fav.anime_name}
                                                </h3>
                                                <span className="text-xs text-neutral-500 bg-black/40 px-3 py-1 rounded-full border border-white/5">
                                                    {new Date(fav.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-yellow-100/80 font-medium mb-1">
                                                {fav.theme_type} {fav.theme_name} <span className="text-neutral-500 mx-2">•</span> {fav.song_title}
                                            </p>
                                            <p className="text-neutral-500 text-sm">{fav.artist}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Friends Tab */}
                {activeTab === 'friends' && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-3">
                            <span>Amigos</span>
                            <span className="text-sm bg-premium-black-200 text-neutral-400 px-3 py-1 rounded-full font-normal">{friends.length} amigos</span>
                            {isOwnProfile && (
                                <button
                                    onClick={() => setShowFriendsManager(true)}
                                    className={`relative p-2 bg-premium-red-600 hover:bg-premium-red-700 text-white rounded-full transition-all hover:scale-110 shadow-lg ${pendingRequests.length > 0 ? 'animate-pulse' : ''}`}
                                    title={pendingRequests.length > 0 ? `${pendingRequests.length} solicitud(es) pendiente(s)` : "Gestionar Amigos"}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    {pendingRequests.length > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-5 w-5 bg-yellow-500 text-white text-xs font-bold items-center justify-center">
                                                {pendingRequests.length}
                                            </span>
                                        </span>
                                    )}
                                </button>
                            )}
                        </h2>

                        {friends.length === 0 ? (
                            <div className="text-center py-20 text-neutral-500 bg-black/20 rounded-2xl border border-dashed border-white/10">
                                <div className="text-7xl mb-6 opacity-50">👥</div>
                                <p className="text-xl font-medium mb-2">Lista de amigos vacía</p>
                                <p className="text-sm">Busca usuarios y agrégalos para verlos aquí.</p>
                                {isOwnProfile && (
                                    <button
                                        onClick={() => setShowFriendsManager(true)}
                                        className="mt-6 px-6 py-2 bg-premium-red-600 text-white rounded-full hover:bg-premium-red-700 transition-colors font-semibold"
                                    >
                                        Buscar Amigos
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {friends.map((friend) => (
                                    <div key={friend.id} className="card-premium p-4">
                                        <div className="flex items-center gap-4 mb-3">
                                            <img src={friend.avatar_url} alt={friend.username} className="w-14 h-14 rounded-full border-2 border-premium-red-600" />
                                            <div className="flex-1">
                                                <h4 className="font-bold text-white text-lg">{friend.username}</h4>
                                                <span className="text-xs text-green-400 flex items-center gap-1">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Amigo
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/profile/${friend.username}`)}
                                                className="flex-1 px-3 py-2 bg-premium-black-300 hover:bg-premium-black-200 text-white rounded-lg transition-colors text-sm"
                                            >
                                                Ver Perfil
                                            </button>
                                            {isOwnProfile && (
                                                <button
                                                    onClick={() => openChat(friend)}
                                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                                                    title="Enviar mensaje"
                                                >
                                                    💬
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Friends Manager Modal */}
            {showFriendsManager && (
                <FriendsManager onClose={() => setShowFriendsManager(false)} />
            )}
        </div>
    );
}

export default Profile;
