import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import toast from 'react-hot-toast';

function FloatingChat() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const { isOpen, isMinimized, selectedFriend, closeChat, toggleMinimize } = useChatStore();

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen && selectedFriend && !isMinimized) {
            loadMessages();
            const interval = setInterval(loadMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [isOpen, selectedFriend, isMinimized]);

    useEffect(() => {
        if (!isMinimized) {
            scrollToBottom();
        }
    }, [messages, isMinimized]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async () => {
        if (!selectedFriend) return;

        try {
            const conversation = await api.getConversation(selectedFriend.id || selectedFriend.friend_id);
            setMessages(conversation);

            // Marcar como leídos
            conversation.forEach(msg => {
                if (msg.receiver_id === user.id && !msg.is_read) {
                    api.markMessageAsRead(msg.id);
                }
            });
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedFriend) return;

        try {
            setLoading(true);
            await api.sendMessage(selectedFriend.id || selectedFriend.friend_id, 'text', newMessage);
            setNewMessage('');
            loadMessages();
        } catch (error) {
            toast.error('Error enviando mensaje');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = (roomCode) => {
        navigate(`/room/${roomCode}`);
    };

    const isInvitationExpired = (expiresAt) => {
        return new Date(expiresAt) < new Date();
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

    if (!isOpen || !selectedFriend) return null;

    const friendName = selectedFriend.username || selectedFriend.friend_username;
    const friendAvatar = selectedFriend.avatar_url || selectedFriend.friend_avatar;

    return (
        <div className="fixed bottom-4 right-40 z-50 flex flex-col">
            {/* Minimized State */}
            {isMinimized ? (
                <button
                    onClick={toggleMinimize}
                    className="glass-dark rounded-t-2xl px-6 py-3 flex items-center gap-3 hover:bg-white/10 transition-all shadow-2xl border-t border-x border-premium-red-600/30"
                >
                    <img
                        src={friendAvatar}
                        alt={friendName}
                        className="w-8 h-8 rounded-full border-2 border-premium-red-600"
                    />
                    <span className="font-bold text-white">{friendName}</span>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                </button>
            ) : (
                /* Maximized State */
                <div className="glass-dark rounded-2xl w-96 h-[500px] flex flex-col shadow-2xl border border-premium-red-600/30">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <img
                                src={friendAvatar}
                                alt={friendName}
                                className="w-10 h-10 rounded-full border-2 border-premium-red-600"
                            />
                            <div>
                                <h3 className="font-bold text-white text-sm">{friendName}</h3>
                                <span className="text-xs text-green-400 flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                    Online
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={toggleMinimize}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Minimizar"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <button
                                onClick={closeChat}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Cerrar"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">
                        {messages.length === 0 ? (
                            <div className="text-center py-8 text-neutral-500">
                                <div className="text-4xl mb-2">💬</div>
                                <p className="text-sm">No hay mensajes</p>
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMine = msg.sender_id === user.id;
                                const isExpired = msg.message_type === 'room_invitation' && isInvitationExpired(msg.expires_at);

                                return (
                                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] flex flex-col gap-1 ${isMine ? 'items-end' : 'items-start'}`}>
                                            {msg.message_type === 'text' ? (
                                                <div className={`px-3 py-2 rounded-2xl text-sm ${isMine
                                                    ? 'bg-premium-red-600 text-white'
                                                    : 'bg-premium-black-300 text-white'
                                                    }`}>
                                                    <p className="break-words">{msg.content}</p>
                                                </div>
                                            ) : (
                                                <div className={`px-3 py-2 rounded-2xl border text-sm ${isExpired
                                                    ? 'bg-neutral-800/50 border-neutral-700 opacity-60'
                                                    : isMine
                                                        ? 'bg-premium-red-600/20 border-premium-red-600'
                                                        : 'bg-blue-600/20 border-blue-600'
                                                    }`}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-lg">🎬</span>
                                                        <div>
                                                            <p className="font-bold text-white text-xs">
                                                                {isMine ? 'Invitaste' : 'Te invitó'}
                                                            </p>
                                                            <p className="text-xs text-neutral-300">{msg.room_name}</p>
                                                        </div>
                                                    </div>
                                                    {!isExpired && !isMine ? (
                                                        <button
                                                            onClick={() => handleJoinRoom(msg.room_code)}
                                                            className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
                                                        >
                                                            Unirse
                                                        </button>
                                                    ) : isExpired ? (
                                                        <p className="text-xs text-neutral-500 text-center">Expirada</p>
                                                    ) : null}
                                                </div>
                                            )}
                                            <span className="text-xs text-neutral-600 px-1">
                                                {formatTime(msg.created_at)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe..."
                                className="flex-1 px-3 py-2 bg-premium-black-300 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-premium-red-600"
                                disabled={loading}
                            />
                            <button
                                type="submit"
                                disabled={loading || !newMessage.trim()}
                                className="px-4 py-2 bg-premium-red-600 hover:bg-premium-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-semibold"
                            >
                                ➤
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default FloatingChat;
