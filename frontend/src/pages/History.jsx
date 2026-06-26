import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import { api } from '../lib/api';

export default function History() {
  const [sessions, setSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
                <div className="mb-2 md:mb-0">
                  <span className="text-ink text-xs md:text-sm">{session.name}</span>
                  <Badge variant="neutral" className="ml-2 md:ml-3">
                    {session.agent}
                  </Badge>
                </div>
                <span className="text-muted text-[10px] md:text-xs font-mono">{session.timestamp}</span>
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
