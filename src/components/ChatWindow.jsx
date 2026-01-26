import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';

function ChatWindow({ friend, onClose }) {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        loadMessages();
        // Recargar mensajes cada 3 segundos
        const interval = setInterval(loadMessages, 3000);
        return () => clearInterval(interval);
    }, [friend.id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async () => {
        try {
            const conversation = await api.getConversation(friend.id);
            setMessages(conversation);

            // Marcar mensajes no leídos como leídos
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
        if (!newMessage.trim()) return;

        try {
            setLoading(true);
            await api.sendMessage(friend.id, 'text', newMessage);
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
        onClose();
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
        if (diffMins < 60) return `Hace ${diffMins}m`;
        if (diffMins < 1440) return `Hace ${Math.floor(diffMins / 60)}h`;
        return date.toLocaleDateString();
    };

    return (
        <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 px-4" onClick={onClose}>
            <div
                className="glass-dark rounded-2xl w-full max-w-2xl h-[600px] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-premium-black-200">
                    <div className="flex items-center gap-3">
                        <img
                            src={friend.avatar_url || friend.friend_avatar}
                            alt={friend.username || friend.friend_username}
                            className="w-12 h-12 rounded-full border-2 border-premium-red-600"
                        />
                        <div>
                            <h3 className="text-xl font-bold text-white">
                                {friend.username || friend.friend_username}
                            </h3>
                            <span className="text-xs text-neutral-500">Chat directo</span>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500">
                            <div className="text-6xl mb-4">💬</div>
                            <p>No hay mensajes aún</p>
                            <p className="text-sm mt-2">Envía el primer mensaje</p>
                        </div>
                    ) : (
                        messages.map((msg) => {
                            const isMine = msg.sender_id === user.id;
                            const isExpired = msg.message_type === 'room_invitation' && isInvitationExpired(msg.expires_at);

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                                        {msg.message_type === 'text' ? (
                                            <div
                                                className={`px-4 py-2 rounded-2xl ${isMine
                                                    ? 'bg-premium-red-600 text-white'
                                                    : 'bg-premium-black-300 text-white'
                                                    }`}
                                            >
                                                <p className="break-words">{msg.content}</p>
                                            </div>
                                        ) : (
                                            <div
                                                className={`px-4 py-3 rounded-2xl border-2 ${isExpired
                                                    ? 'bg-neutral-800/50 border-neutral-700 opacity-60'
                                                    : isMine
                                                        ? 'bg-premium-red-600/20 border-premium-red-600'
                                                        : 'bg-blue-600/20 border-blue-600'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-2xl">🎬</span>
                                                    <div>
                                                        <p className="font-bold text-white">
                                                            {isMine ? 'Invitaste a' : 'Te invitó a'}
                                                        </p>
                                                        <p className="text-sm text-neutral-300">{msg.room_name}</p>
                                                    </div>
                                                </div>
                                                {!isExpired && !isMine ? (
                                                    <button
                                                        onClick={() => handleJoinRoom(msg.room_code)}
                                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
                                                    >
                                                        Unirse a la Sala
                                                    </button>
                                                ) : isExpired ? (
                                                    <p className="text-xs text-neutral-500 text-center">Invitación expirada</p>
                                                ) : null}
                                            </div>
                                        )}
                                        <span className="text-xs text-neutral-600 px-2">
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
                <form onSubmit={handleSendMessage} className="p-6 border-t border-premium-black-200">
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Escribe un mensaje..."
                            className="input-premium flex-1"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !newMessage.trim()}
                            className="px-6 py-3 bg-premium-red-600 hover:bg-premium-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                        >
                            {loading ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                    <p className="text-xs text-neutral-600 mt-2">
                        Los mensajes se eliminan automáticamente después de 24 horas
                    </p>
                </form>
            </div>
        </div>
    );
}

export default ChatWindow;
