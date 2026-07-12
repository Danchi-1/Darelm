import Sidebar from './Sidebar';
import { useLayoutStore } from '../../store/layoutStore';
import { PanelLeft } from 'lucide-react';
import clsx from 'clsx';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLayout({ children }) {
  const { isSidebarOpen, setSidebarOpen } = useLayoutStore();
  const location = useLocation();

  return (
    <div className="flex h-screen bg-void overflow-hidden">
      <Sidebar />
      
      <div 
        className={clsx(
          "flex-1 flex flex-col transition-all duration-300 min-w-0 h-screen relative",
          isSidebarOpen ? "md:ml-64" : "ml-0"
        )}
      >
        {/* Floating Sidebar Toggle Button for Desktop when closed, and Mobile always */}
        <button 
          onClick={() => setSidebarOpen(true)}
          className={clsx(
            "absolute top-4 left-4 z-40 p-2 text-muted hover:text-ink transition-colors bg-surface/80 backdrop-blur border border-border rounded-btn shadow-sm",
            isSidebarOpen ? "md:hidden" : "block"
          )}
        >
          <PanelLeft size={20} />
        </button>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname.split('/')[1]}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
