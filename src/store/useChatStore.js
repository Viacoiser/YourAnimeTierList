import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useChatStore = create(
    persist(
        (set) => ({
            isOpen: false,
            isMinimized: false,
            selectedFriend: null,
            unreadCount: 0,

            openChat: (friend) => set({ isOpen: true, isMinimized: false, selectedFriend: friend }),
            closeChat: () => set({ isOpen: false, selectedFriend: null }),
            minimizeChat: () => set({ isMinimized: true }),
            maximizeChat: () => set({ isMinimized: false }),
            toggleMinimize: () => set((state) => ({ isMinimized: !state.isMinimized })),
            setUnreadCount: (count) => set({ unreadCount: count }),
        }),
        {
            name: 'chat-storage',
            partialize: (state) => ({
                isOpen: state.isOpen,
                isMinimized: state.isMinimized,
                selectedFriend: state.selectedFriend,
            }),
        }
    )
);

export default useChatStore;
