import Sidebar from './Sidebar';
import { useLayoutStore } from '../../store/layoutStore';
import { PanelLeft } from 'lucide-react';
import clsx from 'clsx';

export default function AppLayout({ children }) {
  const { isSidebarOpen, setSidebarOpen } = useLayoutStore();

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
          {children}
        </main>
      </div>
    </div>
  );
}
