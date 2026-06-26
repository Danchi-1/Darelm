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
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },
  initializeAuth: () => {
    // Kept for backwards compatibility but handled synchronously above
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (token && user) {
      set({ user, token, isAuthenticated: true });
    }
  },
}));
