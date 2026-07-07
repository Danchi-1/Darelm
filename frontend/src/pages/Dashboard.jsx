import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';

const agents = [
  {
    number: '01',
    name: 'Conversational Analyst',
    description: 'Ask questions about your data in plain language',
    capabilities: ['Natural language to SQL', 'Auto-generated charts', 'Multi-turn context'],
  },
  {
    number: '02',
    name: 'Autopilot Analyst',
    description: 'Describe an analytical goal and get a complete report',
    capabilities: ['Autonomous planning', 'Self-correcting execution', 'Structured reports'],
  },
  {
    number: '03',
    name: 'ML Experimenter',
    description: 'State a modeling question and get trained models',
    capabilities: ['Auto preprocessing', 'Model selection', 'Full evaluation'],
  },
];

const recentSessions = [
  { id: 1, name: 'Sales Q1 Analysis', agent: 'Autopilot Analyst', timestamp: '2 hours ago' },
  { id: 2, name: 'Customer Churn Prediction', agent: 'ML Experimenter', timestamp: '1 day ago' },
  { id: 3, name: 'Revenue by Region', agent: 'Conversational Analyst', timestamp: '3 days ago' },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const userName = user?.name || user?.email?.split('@')[0] || 'User';
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({ datasets: 0, sessions: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [datasetsRes, sessions01, sessions02, sessions03] = await Promise.all([
          api.getDatasets(),
          api.getSessions(),
          api.getAutopilotSessions(),
          api.getMLSessions()
        ]);
        
        setSessions(sessions01);
        setStats({
          datasets: datasetsRes.length,
          sessions: sessions01.length + sessions02.length + sessions03.length
        });
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 md:p-12 pb-20 md:pb-12 flex flex-col items-center justify-center w-full min-h-full">
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-xl md:text-2xl text-ink mb-2">
            {getGreeting()}, {userName}.
          </h1>
          <p className="text-muted">What do you want to do?</p>
        </div>

        {/* Analytics Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 w-full max-w-4xl mx-auto">
          <div className="bg-surface border border-border rounded-card p-6 flex flex-col justify-center items-center relative overflow-hidden group hover:border-signal transition-colors">
            <div className="absolute inset-0 bg-signal/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-muted text-sm font-mono mb-2">Connected Datasets</span>
            <span className="text-4xl text-ink font-mono">{isLoading ? '-' : stats.datasets}</span>
          </div>
          <div className="bg-surface border border-border rounded-card p-6 flex flex-col justify-center items-center relative overflow-hidden group hover:border-signal transition-colors">
            <div className="absolute inset-0 bg-signal/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-muted text-sm font-mono mb-2">AI Sessions Run</span>
            <span className="text-4xl text-ink font-mono">{isLoading ? '-' : stats.sessions}</span>
          </div>
          <div className="bg-surface border border-border rounded-card p-6 flex flex-col justify-center items-center relative overflow-hidden group hover:border-signal transition-colors">
            <div className="absolute inset-0 bg-signal/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-muted text-sm font-mono mb-2">Active Agents</span>
            <span className="text-4xl text-signal font-mono">3</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-12 w-full max-w-4xl mx-auto">
          {agents.map((agent) => (
            <Link
              key={agent.number}
              to={`/session/new?agent=${agent.number}`}
              className="bg-surface border border-border rounded-card p-4 md:p-6 hover:border-signal transition-colors duration-200 group"
            >
              <span className="font-mono text-muted text-xs md:text-sm">{agent.number}</span>
              <h3 className="font-mono text-base md:text-lg text-ink mt-2 mb-2 md:mb-3">{agent.name}</h3>
              <p className="text-xs md:text-sm text-muted mb-3 md:mb-4">{agent.description}</p>
              <ul className="space-y-1 md:space-y-2">
                {agent.capabilities.map((capability, i) => (
                  <li key={i} className="text-xs md:text-sm text-ink flex items-start">
                    <span className="text-signal mr-2">•</span>
                    {capability}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>

        <div className="w-full max-w-4xl mx-auto">
          <h2 className="font-mono text-base md:text-lg text-ink mb-4">Recent sessions</h2>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {isLoading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border">
                    <div className="mb-2 md:mb-0 flex items-center gap-2 md:gap-3">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/session/${session.id}?agent=01`}
                  className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-border last:border-b-0 hover:bg-surface-raised transition-colors"
                >
                  <div className="mb-2 md:mb-0">
                    <span className="text-ink text-xs md:text-sm">{session.title}</span>
                    <Badge variant="neutral" className="ml-2 md:ml-3">
                      Analyst
                    </Badge>
                  </div>
                  <span className="text-muted text-[10px] md:text-xs font-mono">{new Date(session.created_at).toLocaleDateString()}</span>
                </Link>
              ))
            ) : (
              <div className="px-4 md:px-6 py-8 text-center text-muted text-sm">
                No recent sessions
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
