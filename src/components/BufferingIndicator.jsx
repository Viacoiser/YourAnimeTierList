import React, { useEffect, useState } from 'react';

const BufferingIndicator = ({ bufferingUsers, members }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (bufferingUsers && bufferingUsers.length > 0) {
            setVisible(true);
        } else {
            const timer = setTimeout(() => setVisible(false), 500);
            return () => clearTimeout(timer);
        }
    }, [bufferingUsers]);

    if (!visible && (!bufferingUsers || bufferingUsers.length === 0)) return null;

    return (
        <div className={`fixed top-20 right-4 z-50 transition-opacity duration-300 ${bufferingUsers.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
            <div className="bg-black/60 backdrop-blur-md border border-yellow-500/30 rounded-lg p-3 shadow-lg flex flex-col gap-2 min-w-[200px]">
                <div className="flex items-center space-x-2 text-yellow-400 border-b border-white/10 pb-2 mb-1">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </span>
                    <span className="text-sm font-semibold">Buffering...</span>
                </div>

                <div className="flex flex-col gap-2">
                    {bufferingUsers.map(userId => {
                        const member = members.find(m => m.id === userId);
                        if (!member) return null;

                        return (
                            <div key={userId} className="flex items-center space-x-2 animate-pulse">
                                <img
                                    src={member.avatar_url || `https://ui-avatars.com/api/?name=${member.username}`}
                                    alt={member.username}
                                    className="w-6 h-6 rounded-full border border-gray-400"
                                />
                                <span className="text-sm text-gray-200">{member.username}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BufferingIndicator;
