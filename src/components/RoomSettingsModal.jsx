import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';

function RoomSettingsModal({ isOpen, onClose }) {
    const { roomName, waitMode, updateRoomSettings, isPlaying } = useStore();

    const [name, setName] = useState(roomName || '');
    const [wait, setWait] = useState(waitMode || false);

    useEffect(() => {
        if (isOpen) {
            setName(roomName || '');
            setWait(waitMode || false);
        }
    }, [isOpen, roomName, waitMode]);

    const handleSave = () => {
        updateRoomSettings({ roomName: name, waitMode: wait });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/95 flex justify-center items-center z-50 px-4"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
            onClick={onClose}
        >
            <div
                className="glass-dark rounded-2xl p-8 max-w-md w-full border border-premium-red-600/20"
                style={{ animation: 'scaleIn 0.2s ease-out' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-display font-bold text-gradient-red">
                        Configuración Sala
                    </h2>
                    <p className="text-neutral-400 mt-2">Ajusta las reglas de la sala</p>
                </div>

                {/* Room Name */}
                <div className="mb-6">
                    <label className="block text-neutral-400 text-sm mb-2">Nombre de la Sala</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-premium w-full"
                        maxLength={20}
                    />
                </div>

                {/* Wait Mode Toggle */}
                <div className="flex items-center justify-between mb-6 p-3 rounded-xl bg-black/20 border border-white/5">
                    <div className="text-left">
                        <span className="block text-white font-semibold flex items-center gap-2">
                            Modo Espera ⏳
                        </span>
                        <span className="text-xs text-neutral-400">Todos deben cargar antes de ver</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={wait}
                            onChange={(e) => setWait(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-premium-red-600"></div>
                    </label>
                </div>

                <div className="flex gap-3">
                    <button
                        className="btn-premium flex-1"
                        onClick={handleSave}
                    >
                        Guardar Cambios
                    </button>
                    <button
                        className="btn-secondary flex-1"
                        onClick={onClose}
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RoomSettingsModal;
