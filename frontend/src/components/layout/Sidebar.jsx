import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Database, Settings, PanelLeft, MoreVertical, Pencil, Trash2, Plus, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../store/authStore';
import { useLayoutStore } from '../../store/layoutStore';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';

const navItems = [
  { label: 'New session', path: '/dashboard', icon: Plus },
  { label: 'Datasets', path: '/datasets', icon: Database },
  { label: 'Settings', path: '/settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  
  const { isSidebarOpen, setSidebarOpen } = useLayoutStore();
  const addToast = useToastStore((state) => state.addToast);

  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSession, setEditingSession] = useState(null);
  const [editName, setEditName] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('01');

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const data = selectedAgent === '01' 
          ? await api.getSessions() 
          : await api.getAutopilotSessions();
        setSessions(data);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, [location.pathname, selectedAgent]); // Refetch when navigation or agent changes

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDelete = async (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      addToast('Session deleted successfully', 'success');
      
      // If we are currently on this session page, navigate away
      if (location.pathname === `/session/${sessionId}`) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      addToast('Failed to delete session: ' + error.message, 'error');
    }
  };

  const handleStartRename = (session, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSession(session.id);
    setEditName(session.title);
    setOpenMenuId(null);
  };

  const handleSaveRename = async (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editName.trim()) {
      addToast('Session name cannot be empty', 'error');
      return;
    }
    
    try {
      await api.updateSession(sessionId, { title: editName });
      setSessions(sessions.map(s => s.id === sessionId ? { ...s, title: editName } : s));
      setEditingSession(null);
      setEditName('');
      addToast('Session renamed successfully', 'success');
    } catch (error) {
      console.error('Failed to rename session:', error);
      addToast('Failed to rename session: ' + error.message, 'error');
    }
  };

  // Organize sessions by date groups (Today, Previous 7 Days, Older)
  const groupSessions = () => {
    const groups = { 'Today': [], 'Previous 7 Days': [], 'Older': [] };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    sessions.forEach(session => {
      const sessionDate = new Date(session.created_at);
      if (sessionDate >= today) {
        groups['Today'].push(session);
      } else if (sessionDate >= lastWeek) {
        groups['Previous 7 Days'].push(session);
      } else {
        groups['Older'].push(session);
      }
    });
    
    return groups;
  };

  const groupedSessions = groupSessions();

  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-void/80 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={clsx(
          'fixed top-0 left-0 h-screen bg-surface border-r border-border flex flex-col z-50 transition-transform duration-300 w-64',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-[256px]'
        )}
      >
        <div className="p-4 flex shrink-0 items-center justify-between border-b border-border">
          <Link to="/" className="font-mono text-xl text-ink hover:text-signal transition-colors cursor-pointer">
            Darelm
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-muted hover:text-ink transition-colors"
          >
            <PanelLeft size={20} />
          </button>
        </div>

        <nav className="p-3 border-b border-border space-y-1 shrink-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-btn text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-signal-dim text-ink border border-signal'
                    : 'text-muted hover:text-ink hover:bg-surface-raised border border-transparent'
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Chat History Section */}
        <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-3">
          <div className="mb-4 px-2">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-btn text-xs text-ink p-2 focus:outline-none focus:border-signal outline-none"
            >
              <option value="01">Agent 01 - Conversational</option>
              <option value="02">Agent 02 - Autopilot</option>
            </select>
          </div>
          
          {isLoading ? (
            <div className="space-y-4 px-2">
              <div className="h-4 w-16 bg-surface-raised rounded animate-pulse" />
              <div className="h-8 w-full bg-surface-raised rounded animate-pulse" />
              <div className="h-8 w-full bg-surface-raised rounded animate-pulse" />
            </div>
          ) : sessions.length > 0 ? (
            Object.entries(groupedSessions).map(([groupName, groupSessions]) => (
              groupSessions.length > 0 && (
                <div key={groupName} className="mb-6">
                  <h4 className="text-[10px] font-mono text-muted uppercase tracking-wider mb-2 px-3">
                    {groupName}
                  </h4>
                  <ul className="space-y-1">
                    {groupSessions.map((session) => (
                      <li key={session.id} className="relative group">
                        {editingSession === session.id ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface-raised rounded-btn border border-border">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent text-sm text-ink outline-none flex-1 w-full"
                              autoFocus
                              onBlur={(e) => handleSaveRename(session.id, e)}
                            />
                          </div>
                        ) : (
                          <Link
                            to={`/session/${session.id}?agent=${selectedAgent}`}
                            className={clsx(
                              'flex items-center justify-between px-3 py-2 rounded-btn text-sm transition-colors duration-150 relative overflow-hidden group',
                              location.pathname === `/session/${session.id}`
                                ? 'bg-surface-raised text-ink'
                                : 'text-muted hover:text-ink hover:bg-surface-raised/50'
                            )}
                          >
                            <span className="truncate pr-6">{session.title}</span>
                            
                            {/* Action Menu Toggle */}
                            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-gradient-to-l from-surface-raised via-surface-raised to-transparent pl-4">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === session.id ? null : session.id);
                                }}
                                className="p-1 text-muted hover:text-ink rounded"
                              >
                                <MoreVertical size={14} />
                              </button>
                            </div>
                          </Link>
                        )}
                        
                        {/* Dropdown Menu */}
                        {openMenuId === session.id && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-surface border border-border rounded shadow-lg z-50 py-1">
                            <button
                              onClick={(e) => handleStartRename(session, e)}
                              className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface-raised flex items-center gap-2"
                            >
                              <Pencil size={12} /> Rename
                            </button>
                            <button
                              onClick={(e) => handleDelete(session.id, e)}
                              className="w-full text-left px-3 py-1.5 text-xs text-danger hover:bg-surface-raised flex items-center gap-2"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            ))
          ) : (
            <div className="px-3 py-4 text-xs text-muted text-center font-mono">
              No chat history
            </div>
          )}
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-t border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 shrink-0 rounded-full bg-signal-dim flex items-center justify-center">
              <span className="font-mono text-xs text-signal">
                {userName.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-ink truncate">{userName}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
