import React, { useState } from 'react';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';

function FloatingReadyButton() {
    const { waitMode, isPlaying, sendUserReady, currentUser } = useStore();
    const [hasClickedReady, setHasClickedReady] = useState(false);

    // Solo mostrar si:
    // 1. waitMode está activo
    // 2. No está reproduciendo
    // 3. El usuario NO es host (los hosts tienen el botón "Forzar Inicio")
    const isHost = currentUser?.isHost;
    if (!waitMode || isPlaying || isHost) return null;

    const handleReady = () => {
        if (!hasClickedReady) {
            sendUserReady();
            setHasClickedReady(true);
            toast.success('¡Has confirmado que estás listo!');
        }
    };

    return (
        <button
            onClick={handleReady}
            disabled={hasClickedReady}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border transition-all duration-300 shadow-2xl backdrop-blur-md ${hasClickedReady
                ? 'bg-green-600/20 border-green-500/30 text-green-400 cursor-default'
                : 'bg-premium-red-600 border-premium-red-500 text-white hover:scale-105 hover:bg-premium-red-700 cursor-pointer'
                }`}
            title="Confirmar que estás listo"
        >
            <span className="text-xl">{hasClickedReady ? '✅' : '👋'}</span>
            <div className="flex flex-col items-start">
                <span className="font-bold text-sm leading-tight">
                    {hasClickedReady ? 'Estás Listo' : 'Estoy Listo'}
                </span>
                {!hasClickedReady && <span className="text-[10px] opacity-80">Confirmar asistencia</span>}
            </div>
        </button>
    );
}

export default FloatingReadyButton;
