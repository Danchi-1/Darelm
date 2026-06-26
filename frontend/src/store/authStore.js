import { create } from 'zustand';

const initialToken = localStorage.getItem('token');
const initialUser = JSON.parse(localStorage.getItem('user') || 'null');

export const useAuthStore = create((set) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!(initialToken && initialUser),
  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('lastActivity', Date.now().toString());
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('lastActivity');
    set({ user: null, token: null, isAuthenticated: false });
  },
  initializeAuth: () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const lastActivity = localStorage.getItem('lastActivity');
    
    // Check if session has been inactive for more than 1 hour (60 * 60 * 1000 ms)
    if (lastActivity && Date.now() - parseInt(lastActivity, 10) > 60 * 60 * 1000) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('lastActivity');
      set({ user: null, token: null, isAuthenticated: false });
      return;
    }

    if (token && user) {
      localStorage.setItem('lastActivity', Date.now().toString());
      set({ user, token, isAuthenticated: true });
    }
  },
}));
