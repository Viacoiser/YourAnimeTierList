import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import FloatingChatButton from './FloatingChatButton';
import FloatingReadyButton from './FloatingReadyButton';
import toast from 'react-hot-toast';

function FloatingButtons() {
    const { user, login, register } = useAuthStore();
    const navigate = useNavigate();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [authMode, setAuthMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogout = () => {
        useAuthStore.getState().logout();
        navigate('/');
    };

    const handleAuth = async () => {
        if (!username.trim() || !password.trim()) {
            toast.error('Completa todos los campos');
            return;
        }

        setIsLoading(true);
        try {
            if (authMode === 'login') {
                await login(username, password);
                toast.success(`¡Bienvenido, ${username}!`);
                setShowLoginModal(false);
                setUsername('');
                setPassword('');
            } else {
                await register(username, password);
                toast.success('Registro exitoso. Ahora inicia sesión.');
                setAuthMode('login');
                setPassword('');
            }
        } catch (error) {
            console.error('Error de autenticación:', error);
            toast.error(error.message || 'Error de autenticación');
        } finally {
            // Asegurar que siempre se resetea el loading
            setIsLoading(false);
        }
    };

    // Si no hay usuario, mostrar solo el botón de login
    if (!user) {
        return (
            <>
                <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="glass-dark px-6 py-3 rounded-2xl border border-premium-red-600/30 shadow-2xl bg-black/80 backdrop-blur-md hover:border-premium-red-600 transition-all hover:scale-105 text-white font-bold flex items-center gap-2"
                        title="Iniciar Sesión"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Iniciar Sesión
                    </button>
                </div>

                {/* Modal de Login */}
                {showLoginModal && (
                    <div
                        className="fixed inset-0 bg-black/95 flex justify-center items-center z-50 px-4"
                        onClick={() => setShowLoginModal(false)}
                    >
                        <div
                            className="glass-dark rounded-2xl p-8 max-w-md w-full border border-premium-red-600/20"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-6">
                                <h2 className="text-3xl font-display font-bold text-gradient-red">
                                    Iniciar Sesión
                                </h2>
                                <div className="flex gap-4 mb-6 border-b border-premium-black-200 mt-4">
                                    <button
                                        onClick={() => setAuthMode('login')}
                                        className={`flex-1 pb-3 font-semibold transition-colors ${authMode === 'login' ? 'text-premium-red-500 border-b-2 border-premium-red-600' : 'text-neutral-500'
                                            }`}
                                    >
                                        Iniciar Sesión
                                    </button>
                                    <button
                                        onClick={() => setAuthMode('register')}
                                        className={`flex-1 pb-3 font-semibold transition-colors ${authMode === 'register' ? 'text-premium-red-500 border-b-2 border-premium-red-600' : 'text-neutral-500'
                                            }`}
                                    >
                                        Registrarse
                                    </button>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <input
                                        type="text"
                                        placeholder="Usuario"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full px-4 py-3 bg-premium-black-300 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-premium-red-600"
                                        maxLength={20}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-premium-black-300 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-premium-red-600"
                                        onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                                    />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        className="flex-1 px-6 py-3 bg-premium-red-600 hover:bg-premium-red-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50"
                                        onClick={handleAuth}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? 'Procesando...' : (authMode === 'login' ? 'Entrar' : 'Registrarse')}
                                    </button>
                                    <button
                                        className="flex-1 px-6 py-3 glass-dark text-white rounded-lg font-bold border border-premium-red-600/30 hover:border-premium-red-600 transition-colors"
                                        onClick={() => setShowLoginModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    }

    // Si hay usuario, mostrar ready, chat y perfil
    return (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in-up">
            <div className="flex items-center gap-3">
                {/* Ready Button (solo si waitMode activo) */}
                <FloatingReadyButton />

                {/* Chat Button */}
                <FloatingChatButton />

                {/* Profile Button */}
                <div className="flex items-center gap-3 glass-dark px-4 py-3 rounded-2xl border border-premium-red-600/30 shadow-2xl bg-black/80 backdrop-blur-md">
                    <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => navigate(`/profile/${user.id || user.uid}`)}
                    >
                        <img
                            src={user.photoURL || user.avatar_url || 'https://via.placeholder.com/40'}
                            alt={user.displayName || user.username}
                            className="w-10 h-10 rounded-full border-2 border-premium-red-600"
                        />
                        <div className="flex flex-col">
                            <span className="text-neutral-200 font-bold text-sm leading-tight">
                                {user.displayName || user.username || user.email}
                            </span>
                            <span className="text-premium-red-400 text-xs font-medium">
                                Ver Perfil
                            </span>
                        </div>
                    </div>
                    <div className="h-8 w-[1px] bg-neutral-700 mx-1"></div>
                    <button
                        onClick={handleLogout}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Cerrar Sesión"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FloatingButtons;
