import { create } from 'zustand';
import { api } from '../lib/api';

const initialUser = JSON.parse(localStorage.getItem('user') || 'null');

export const useAuthStore = create((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  login: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('lastActivity', Date.now().toString());
    set({ user, isAuthenticated: true });
  },
  logout: async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error("Logout API failed", e);
    }
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    set({ user: null, isAuthenticated: false });
  },
  initializeAuth: () => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const lastActivity = localStorage.getItem('lastActivity');
    
    // Check if session has been inactive for more than 1 hour (60 * 60 * 1000 ms)
    if (lastActivity && Date.now() - parseInt(lastActivity, 10) > 60 * 60 * 1000) {
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
      set({ user: null, isAuthenticated: false });
      return;
    }

    if (user) {
      localStorage.setItem('lastActivity', Date.now().toString());
      set({ user, isAuthenticated: true });
    }
  },
}));
