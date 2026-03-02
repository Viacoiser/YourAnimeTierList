import React from 'react';

const LoadingProgress = ({ members, loadingProgress, readyCount, totalCount }) => {
    // Calcular porcentaje global basado en el usuario más lento (o promedio, pero "min" es más seguro para wait mode)
    // En el diseño acordado, la barra representa el progreso hacia el "Ready" (50%)

    // Podemos mostrar el progreso promedio para la barra principal para que siempre se mueva
    // O el mínimo para ser estrictos. Usemos un promedio ponderado visualmente.

    const progressValues = Object.values(loadingProgress || {});
    const globalPercent = progressValues.length > 0
        ? Math.min(100, Math.floor(progressValues.reduce((a, b) => a + b, 0) / members.length))
        : 0;

    // Normalizar a 50% (si la meta es 50%, entonces 25% real = 50% visual de la barra de "espera")
    // Pero el usuario pidió "barra de todos". Mejor mostrar 0-100% real pero marcar el 50% como hito.

    return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 backdrop-blur-sm transition-all duration-500">
            <div className="w-full max-w-2xl p-8 bg-[#1a1c29]/90 rounded-2xl border border-gray-700/50 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                        Sincronizando Sala
                    </h2>
                    <p className="text-gray-400 text-lg">
                        Esperando a que todos carguen el video... ({readyCount}/{totalCount})
                    </p>
                </div>

                {/* Global Progress Bar */}
                <div className="mb-8 relative">
                    <div className="h-4 bg-gray-700/50 rounded-full overflow-hidden w-full box-shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 background-animate-shimmer transition-all duration-700 ease-out relative"
                            style={{
                                width: `${globalPercent}%`,
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s linear infinite'
                            }}
                        >
                            <div className="absolute top-0 right-0 h-full w-4 bg-white/20 blur-[2px] animate-pulse"></div>
                        </div>
                    </div>
                    {/* Marker at 50% */}
                    <div className="absolute top-4 left-[50%] -translate-x-1/2 flex flex-col items-center mt-2 w-max">
                        <div className="w-0.5 h-3 bg-white/30 mb-1"></div>
                        <span className="text-xs text-blue-300 font-medium px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                            Zona Ready (50%)
                        </span>
                    </div>
                </div>

                {/* User List Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                    {members.map(member => {
                        const progress = loadingProgress?.[member.id] || 0;
                        const isReady = progress >= 50;

                        return (
                            <div key={member.id} className="flex items-center p-3 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:border-gray-600 transition-colors group">
                                <div className="relative">
                                    <img
                                        src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.username}&background=random`}
                                        alt={member.username}
                                        className={`w-12 h-12 rounded-full border-2 object-cover transition-all duration-300 ${isReady ? 'border-green-500 shadow-[0_0_12px_rgba(34,197,94,0.4)]' : 'border-gray-600 grayscale opacity-70'}`}
                                    />
                                    {isReady && (
                                        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border-2 border-[#1a1c29] animate-bounce-subtle">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                    )}
                                </div>

                                <div className="ml-4 flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`font-medium truncate ${isReady ? 'text-white' : 'text-gray-400'}`}>
                                            {member.username} {member.isHost && <span className="text-xs text-yellow-500 ml-1">👑</span>}
                                        </span>
                                        <span className={`text-xs font-bold ${isReady ? 'text-green-400' : 'text-blue-400'}`}>
                                            {Math.round(progress)}%
                                        </span>
                                    </div>

                                    {/* User Mini Bar */}
                                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden w-full">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${isReady ? 'bg-green-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, progress)}%` }}
                                        ></div>
                                    </div>

                                    <div className="mt-1 h-3">
                                        {isReady ? (
                                            <span className="text-[10px] text-green-500 font-medium flex items-center animate-pulse">
                                                LISTO PARA VER
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-gray-500 flex items-center">
                                                <span className="w-2 h-2 rounded-full border border-gray-500 border-t-transparent animate-spin mr-1"></span>
                                                Cargando...
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    );
};

export default LoadingProgress;
