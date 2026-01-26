import React, { useEffect, useState, useRef } from 'react';

export default function WelcomeScreen({ username, onFinished, isLoading }) {
    const [visible, setVisible] = useState(true);
    const [step, setStep] = useState(0); // 0: Start, 1: Show Name, 2: Fade Out
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const exitTriggered = useRef(false);

    // 1. Iniciar animación de entrada
    useEffect(() => {
        const t1 = setTimeout(() => setStep(1), 500);
        const t2 = setTimeout(() => setMinTimeElapsed(true), 2500);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
        };
    }, []);

    // 2. Controlar la salida cuando pase el tiempo mínimo Y ya no esté cargando
    useEffect(() => {
        if (minTimeElapsed && !isLoading && step >= 1 && !exitTriggered.current) {
            exitTriggered.current = true;

            setTimeout(() => setStep(2), 0);

            const t3 = setTimeout(() => {
                setVisible(false);
                onFinished();
            }, 700);

            return () => clearTimeout(t3);
        }
    }, [minTimeElapsed, isLoading, onFinished]); // REMOVIDO 'step' de dependencias

    if (!visible) return null;

    return (
        <div
            className={`fixed inset-0 z-[100] flex items-center justify-center bg-black transition-opacity duration-700 ease-in-out ${step === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-premium-red-900/10 via-black to-black opacity-60"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-premium-red-600/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>

            <div className="relative text-center z-10 px-4">
                {/* Intro Text */}
                <div className={`transition-all duration-700 transform ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                    <div className="inline-block mb-4">
                        <span className="text-6xl animate-pulse">🎌</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-neutral-200 to-premium-red-200 mb-2">
                        Bienvenido,
                    </h1>
                    <h2 className="text-5xl md:text-7xl font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-premium-red-500 to-premium-red-700 drop-shadow-premium">
                        {username || 'Otaku'}
                    </h2>

                    {/* Loading Indicator */}
                    <div className="mt-12 flex flex-col items-center gap-3">
                        <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-premium-red-600 animate-loading-bar rounded-full"></div>
                        </div>
                        <p className="text-premium-red-400/60 text-xs tracking-widest uppercase font-mono animate-pulse">
                            Sincronizando Archivos
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
