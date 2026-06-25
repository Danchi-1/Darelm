import { Link, useLocation } from 'react-router-dom';
import { Home, Clock, Database, Settings } from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { label: 'New session', path: '/dashboard', icon: Home },
  { label: 'History', path: '/history', icon: Clock },
  { label: 'Datasets', path: '/datasets', icon: Database },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar({ userName = 'User' }) {
  const location = useLocation();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 h-screen bg-surface border-r border-border flex-col fixed left-0 top-0">
        <div className="p-6 border-b border-border">
          <Link to="/" className="font-mono text-xl text-ink mb-4 block hover:text-signal transition-colors">
            Darelm
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-signal-dim flex items-center justify-center">
              <span className="font-mono text-xs text-signal">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-ink">{userName}</span>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={clsx(
                      'block px-4 py-2 rounded-btn text-sm transition-colors duration-150',
                      isActive
                        ? 'bg-signal-dim text-ink border-l-2 border-signal'
                        : 'text-muted hover:text-ink'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-border">
          <p className="font-mono text-[10px] text-muted">
            Powered by Qwen Cloud
          </p>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-50">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center p-2 rounded-btn transition-colors',
                  isActive ? 'text-signal' : 'text-muted'
                )}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
