import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';

function Home() {
  const [userName, setUserName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [waitMode, setWaitMode] = useState(false); // NEW

  const navigate = useNavigate();
  const createRoom = useStore((state) => state.createRoom);
  const joinRoom = useStore((state) => state.joinRoom);

  const { user, setUser, login, register, logout } = useAuthStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [username, setAuthUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      } else {
        await register(username, password);
        toast.success('Registro exitoso. Ahora inicia sesión.');
        setAuthMode('login');
      }
    } catch (error) {
      console.error('Error de autenticación:', error);
      toast.error(error.message || 'Error de autenticación');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setUserName('');
    toast.success('Sesión cerrada');
  };

  const handleCreateRoom = () => {
    if (!userName.trim()) {
      alert(user ? 'Por favor ingresa el nombre de la sala' : 'Por favor ingresa tu nombre');
      return;
    }

    if (user) {
      // Logueado: Input = Nombre Sala, User = Profile
      const profileName = user.displayName || user.email?.split('@')[0] || 'Anfitrión';
      const roomId = createRoom(profileName, userName, waitMode); // (user, roomName, waitMode)
      navigate(`/room/${roomId}`);
    } else {
      // Invitado: Input = Nombre Usuario, Room = Auto
      const roomId = createRoom(userName, null, waitMode); // (userName, roomName=null, waitMode)
      navigate(`/room/${roomId}`);
    }
  };

  const handleJoinRoom = () => {
    if ((!user && !userName.trim()) || !roomCode.trim()) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    // Si está logueado, usar su nombre de perfil para unirse
    const nameToJoin = user ? (user.displayName || user.email?.split('@')[0]) : userName;

    joinRoom(roomCode.toUpperCase(), nameToJoin);
    navigate(`/room/${roomCode.toUpperCase()}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background Blobs */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-premium-black-400 to-premium-black-300">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-72 h-72 bg-premium-red-600 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-premium-red-800 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-premium-red-700 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '4s' }}></div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Hero Section */}
        <div className="text-center max-w-5xl mx-auto animate-fade-in">
          {/* Badge */}


          {/* Main Title */}
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-black mb-6 leading-tight drop-shadow-2xl">
            <span className="block text-gradient-red animate-glow">YourAnime</span>
            <span className="block text-white">TierList</span>
          </h1>

          <p className="text-xl md:text-2xl text-neutral-300 mb-12 font-light max-w-2xl mx-auto leading-relaxed drop-shadow-lg">
            ¡Disfruta openings y endings de anime con tus amigos!
            <span className="text-premium-red-400 font-semibold"> Crea tu sala</span> y comienza a <span className="text-premium-red-400 font-semibold"> puntuar</span> tus favoritos.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              className="group relative px-8 py-4 bg-premium-red-600 text-white rounded-xl font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-glow-red"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span>Crear Sala</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-premium-red-700 to-premium-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            <button
              className="px-8 py-4 glass-dark text-white rounded-xl font-bold text-lg border border-premium-red-600/30 hover:border-premium-red-600 transition-all duration-300 hover:scale-105 backdrop-blur-md"
              onClick={() => setShowJoinModal(true)}
            >
              <span className="flex items-center justify-center gap-2">
                <span>Unirse a Sala</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal para crear sala */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/95 flex justify-center items-center z-50 px-4"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="glass-dark rounded-2xl p-8 max-w-md w-full border border-premium-red-600/20"
            style={{ animation: 'scaleIn 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">

              <h2 className="text-3xl font-display font-bold text-gradient-red">
                Crear Nueva Sala
              </h2>
              <p className="text-neutral-400 mt-2">{user ? 'Ponle un nombre a tu sala' : 'Ingresa tu nombre para comenzar'}</p>
            </div>

            <input
              type="text"
              placeholder={user ? "Nombre de la sala" : "Tu nombre"}
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="input-premium mb-6"
              maxLength={20}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
            />

            {/* Wait Mode Toggle */}
            <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="text-left">
                <span className="block text-white font-semibold">Modo Espera ⏳</span>
                <span className="text-xs text-neutral-400">Permite esperar a los usuarios con menor velocidad de red</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={waitMode}
                  onChange={(e) => setWaitMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-premium-red-600"></div>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                className="btn-premium flex-1"
                onClick={handleCreateRoom}
              >
                Crear Sala
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para unirse a sala */}
      {showJoinModal && (
        <div
          className="fixed inset-0 bg-black/95 flex justify-center items-center z-50 px-4"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="glass-dark rounded-2xl p-8 max-w-md w-full border border-premium-red-600/20"
            style={{ animation: 'scaleIn 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">

              <h2 className="text-3xl font-display font-bold text-gradient-red">
                Unirse a Sala
              </h2>
              <p className="text-neutral-400 mt-2">Ingresa el código de la sala</p>
            </div>

            <input
              type="text"
              placeholder="Código de sala (6 letras)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="input-premium mb-4 text-center text-2xl font-bold tracking-widest"
              maxLength={6}
              autoFocus
            />
            {!user && (
              <input
                type="text"
                placeholder="Tu nombre"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="input-premium mb-6"
                maxLength={20}
                onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
              />
            )}

            <div className="flex gap-3">
              <button
                className="btn-premium flex-1"
                onClick={handleJoinRoom}
              >
                Unirse
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowJoinModal(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para login */}
      {showLoginModal && (
        <div
          className="fixed inset-0 bg-black/95 flex justify-center items-center z-50 px-4"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => setShowLoginModal(false)}
        >
          <div
            className="glass-dark rounded-2xl p-8 max-w-md w-full border border-premium-red-600/20"
            style={{ animation: 'scaleIn 0.2s ease-out' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">

              <h2 className="text-3xl font-display font-bold text-gradient-red">
                Iniciar Sesión
              </h2>
              <div className="flex gap-4 mb-6 border-b border-premium-black-200">
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
                  onChange={(e) => setAuthUsername(e.target.value)}
                  className="input-premium"
                  maxLength={20}
                />
                <input
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-premium"
                  onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
                />
              </div>

              <div className="flex gap-3">
                <button
                  className="btn-premium flex-1"
                  onClick={handleAuth}
                  disabled={isLoading}
                >
                  {isLoading ? 'Procesando...' : (authMode === 'login' ? 'Entrar' : 'Registrarse')}
                </button>
                <button
                  className="btn-secondary flex-1"
                  onClick={() => setShowLoginModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
