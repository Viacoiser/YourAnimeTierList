import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';

function FloatingChatButton() {
    const { user } = useAuthStore();
    const { openChat, setUnreadCount } = useChatStore();
    const [conversations, setConversations] = useState([]);
    const [showList, setShowList] = useState(false);
    const [unreadCount, setLocalUnreadCount] = useState(0);

    useEffect(() => {
        if (user) {
            loadConversations();
            loadUnreadCount();

            // Actualizar cada 5 segundos
            const interval = setInterval(() => {
                loadConversations();
                loadUnreadCount();
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [user]);

    const loadConversations = async () => {
        try {
            const convs = await api.getConversations();
            setConversations(convs);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    };

    const loadUnreadCount = async () => {
        try {
            const { unreadCount: count } = await api.getUnreadCount();
            setLocalUnreadCount(count);
            setUnreadCount(count);
        } catch (error) {
            console.error('Error loading unread count:', error);
        }
    };

    const handleOpenChat = (friend) => {
        openChat(friend);
        setShowList(false);
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return date.toLocaleDateString();
    };

    if (!user) return null;

    return (
        <div className="relative">
            {/* Conversations List */}
            {showList && conversations.length > 0 && (
                <div className="absolute bottom-20 right-0 glass-dark rounded-2xl p-4 w-80 max-h-96 overflow-y-auto shadow-2xl border border-premium-red-600/30 mb-2">
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                        <span>💬</span>
                        <span>Conversaciones</span>
                    </h3>
                    <div className="space-y-2">
                        {conversations.map((conv) => (
                            <button
                                key={conv.friend_id}
                                onClick={() => handleOpenChat({
                                    id: conv.friend_id,
                                    username: conv.friend_username,
                                    avatar_url: conv.friend_avatar
                                })}
                                className="w-full flex items-center gap-3 p-3 hover:bg-white/10 rounded-lg transition-colors text-left"
                            >
                                <div className="relative">
                                    <img
                                        src={conv.friend_avatar}
                                        alt={conv.friend_username}
                                        className="w-12 h-12 rounded-full border-2 border-premium-red-600"
                                    />
                                    {conv.unread_count > 0 && (
                                        <span className="absolute -top-1 -right-1 bg-premium-red-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-white text-sm truncate">
                                        {conv.friend_username}
                                    </h4>
                                    <p className="text-xs text-neutral-400 truncate">
                                        {conv.last_message_type === 'room_invitation'
                                            ? '🎬 Invitación a sala'
                                            : conv.last_message}
                                    </p>
                                </div>
                                <span className="text-xs text-neutral-600">
                                    {formatTime(conv.last_message_time)}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Floating Button */}
            <button
                onClick={() => setShowList(!showList)}
                className="glass-dark px-4 py-3 rounded-2xl border border-premium-red-600/30 shadow-2xl bg-black/80 backdrop-blur-md hover:border-premium-red-600 transition-all hover:scale-105 relative"
                title="Mensajes"
            >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-6 w-6">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-premium-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-6 w-6 bg-premium-red-600 text-white text-xs font-bold items-center justify-center">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    </span>
                )}
            </button>
        </div>
    );
}

export default FloatingChatButton;
