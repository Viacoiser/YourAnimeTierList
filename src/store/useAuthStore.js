import { create } from 'zustand';
import { api } from '../services/api';

const useAuthStore = create((set) => ({
    user: JSON.parse(localStorage.getItem('user')) || null,
    isAuthenticated: !!localStorage.getItem('token'),
    loading: false,

    setUser: (user) => set({ user, isAuthenticated: !!user }),

    login: async (username, password) => {
        set({ loading: true });
        try {
            const data = await api.login(username, password);
            // Mapear datos del backend al formato del frontend
            const user = {
                ...data.user,
                displayName: data.user.username, // El frontend usa displayName
                photoURL: data.user.avatar || data.user.avatar_url, // Backend envía avatar, frontend usa photoURL
            };

            localStorage.setItem('user', JSON.stringify(user));
            set({ user: user, isAuthenticated: true, loading: false });
            return user;
        } catch (error) {
            set({ loading: false });
            throw error;
        }
    },

    register: async (username, password) => {
        set({ loading: true });
        try {
            await api.register(username, password);
            set({ loading: false });
        } catch (error) {
            set({ loading: false });
            throw error;
        }
    },

    logout: () => {
        api.logout();
        localStorage.removeItem('user');
        set({ user: null, isAuthenticated: false });
    },
}));

export default useAuthStore;
