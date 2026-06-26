import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import Button from '../components/ui/Button';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSession, setEditingSession] = useState(null);
  const [editName, setEditName] = useState('');
  const addToast = useToastStore((state) => state.addToast);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data);
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const handleDelete = async (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await api.deleteSession(sessionId);
      setSessions(sessions.filter(s => s.id !== sessionId));
      addToast('Session deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete session:', error);
      addToast('Failed to delete session: ' + error.message, 'error');
    }
  };

  const handleStartRename = (session, e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSession(session.id);
    setEditName(session.name);
  };

  const handleSaveRename = async (sessionId, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!editName.trim()) {
      addToast('Session name cannot be empty', 'error');
      return;
    }
    
    try {
      await api.updateSession(sessionId, { name: editName });
      setSessions(sessions.map(s => s.id === sessionId ? { ...s, name: editName } : s));
      setEditingSession(null);
      setEditName('');
      addToast('Session renamed successfully', 'success');
    } catch (error) {
      console.error('Failed to rename session:', error);
      addToast('Failed to rename session: ' + error.message, 'error');
    }
  };

  const handleCancelRename = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSession(null);
    setEditName('');
  };

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-6 md:p-12 pb-20 md:pb-12">
        <h1 className="font-mono text-2xl text-ink mb-8">History</h1>

        <div className="bg-surface border border-border rounded-card overflow-hidden">
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border">
                  <div className="mb-2 md:mb-0 flex items-center gap-2 md:gap-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-5 w-28" />
                  </div>
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </>
          ) : sessions.length > 0 ? (
            sessions.map((session) => (
              <Link
                key={session.id}
                to={`/session/${session.id}`}
                className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border last:border-b-0 hover:bg-surface-raised transition-colors"
              >
                <div className="mb-2 md:mb-0 flex-1">
                  {editingSession === session.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(session.id, e)}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-surface border border-border rounded-input px-2 py-1 text-sm text-ink focus:border-signal focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span className="text-ink text-xs md:text-sm">{session.title}</span>
                  )}
                  <Badge variant="neutral" className="ml-2 md:ml-3">
                    Analyst
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-muted text-[10px] md:text-xs font-mono">{new Date(session.created_at).toLocaleDateString()}</span>
                  {editingSession === session.id ? (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={(e) => handleSaveRename(session.id, e)}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleCancelRename(e)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleStartRename(session, e)}
                      >
                        Rename
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={(e) => handleDelete(session.id, e)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <div className="px-4 md:px-6 py-8 text-center text-muted text-sm">
              No session history yet
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
