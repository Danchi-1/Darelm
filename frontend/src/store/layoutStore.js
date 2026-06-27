import { create } from 'zustand';

export const useLayoutStore = create((set) => ({
  isSidebarOpen: window.innerWidth >= 768, // Default open on desktop, closed on mobile
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
}));
