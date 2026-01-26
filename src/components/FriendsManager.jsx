import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';

function FriendsManager({ onClose }) {
    const { user } = useAuthStore();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('search'); // 'search', 'requests'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'requests') {
            loadPendingRequests();
        }
    }, [activeTab]);

    const loadPendingRequests = async () => {
        try {
            setLoading(true);
            const requests = await api.getPendingRequests();
            setPendingRequests(requests);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando solicitudes');
        } finally {
            setLoading(false);
        }
    };

    const loadFriends = async () => {
        try {
            setLoading(true);
            const friendsList = await api.getFriends(user.id || user.uid);
            setFriends(friendsList);
        } catch (error) {
            console.error(error);
            toast.error('Error cargando amigos');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (searchQuery.trim().length < 2) {
            toast.error('Escribe al menos 2 caracteres');
            return;
        }

        try {
            setLoading(true);
            console.log('Searching for:', searchQuery);
            const results = await api.searchUsers(searchQuery);
            console.log('Search results:', results);
            setSearchResults(results);
            if (results.length === 0) {
                toast('No se encontraron usuarios con ese nombre');
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error(error.message || 'Error buscando usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (friendId) => {
        try {
            await api.sendFriendRequest(friendId);
            toast.success('Solicitud enviada');
            // Remover de resultados
            setSearchResults(prev => prev.filter(u => u.id !== friendId));
        } catch (error) {
            toast.error(error.message);
        }
    };

    const handleAcceptRequest = async (requestId) => {
        try {
            await api.acceptFriendRequest(requestId);
            toast.success('Solicitud aceptada');
            loadPendingRequests();
        } catch (error) {
            toast.error('Error aceptando solicitud');
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            await api.rejectFriendRequest(requestId);
            toast.success('Solicitud rechazada');
            loadPendingRequests();
        } catch (error) {
            toast.error('Error rechazando solicitud');
        }
    };

    const handleRemoveFriend = async (friendId) => {
        if (!confirm('¿Estás seguro de eliminar este amigo?')) return;

        try {
            await api.removeFriend(friendId);
            toast.success('Amigo eliminado');
            loadFriends();
        } catch (error) {
            toast.error('Error eliminando amigo');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 px-4" onClick={onClose}>
            <div
                className="glass-dark rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-display font-bold text-gradient-red">Amigos</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-premium-black-200">
                    {[
                        { id: 'search', label: '🔍 Buscar', badge: null },
                        { id: 'requests', label: '📬 Solicitudes', badge: pendingRequests.length }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`pb-3 px-2 font-bold transition-all relative ${activeTab === tab.id
                                ? 'text-premium-red-500'
                                : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            {tab.label}
                            {tab.badge !== null && tab.badge > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-premium-red-600 text-white text-xs rounded-full">
                                    {tab.badge}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-premium-red-600 rounded-t-full"></div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Search Tab */}
                {activeTab === 'search' && (
                    <div>
                        <div className="flex gap-3 mb-6">
                            <input
                                type="text"
                                placeholder="Buscar usuarios..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                className="input-premium flex-1"
                            />
                            <button onClick={handleSearch} className="btn-premium px-6" disabled={loading}>
                                {loading ? 'Buscando...' : 'Buscar'}
                            </button>
                        </div>

                        {searchResults.length > 0 ? (
                            <div className="space-y-3">
                                {searchResults.map((user) => (
                                    <div key={user.id} className="card-premium flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={user.avatar_url}
                                                alt={user.username}
                                                className="w-12 h-12 rounded-full border-2 border-premium-red-600"
                                            />
                                            <div>
                                                <h4 className="font-bold text-white">{user.username}</h4>
                                                <p className="text-xs text-neutral-500">
                                                    Miembro desde {new Date(user.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    navigate(`/profile/${user.username}`);
                                                    onClose();
                                                }}
                                                className="px-4 py-2 bg-premium-black-300 hover:bg-premium-black-200 text-white rounded-lg transition-colors"
                                            >
                                                Ver Perfil
                                            </button>
                                            <button
                                                onClick={() => handleSendRequest(user.id)}
                                                className="px-4 py-2 bg-premium-red-600 hover:bg-premium-red-700 text-white rounded-lg transition-colors"
                                            >
                                                Agregar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-neutral-500">
                                <div className="text-6xl mb-4">🔍</div>
                                <p>Busca usuarios para agregar como amigos</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Requests Tab */}
                {activeTab === 'requests' && (
                    <div>
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-premium-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            </div>
                        ) : pendingRequests.length > 0 ? (
                            <div className="space-y-3">
                                {pendingRequests.map((request) => (
                                    <div key={request.request_id} className="card-premium flex items-center justify-between p-4">
                                        <div className="flex items-center gap-3">
                                            <img
                                                src={request.avatar_url}
                                                alt={request.username}
                                                className="w-12 h-12 rounded-full border-2 border-premium-red-600"
                                            />
                                            <div>
                                                <h4 className="font-bold text-white">{request.username}</h4>
                                                <p className="text-xs text-neutral-500">
                                                    {new Date(request.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleAcceptRequest(request.request_id)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                            >
                                                Aceptar
                                            </button>
                                            <button
                                                onClick={() => handleRejectRequest(request.request_id)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                                            >
                                                Rechazar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-neutral-500">
                                <div className="text-6xl mb-4">📬</div>
                                <p>No tienes solicitudes pendientes</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default FriendsManager;
