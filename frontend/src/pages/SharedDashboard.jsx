import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardView from '../components/agents/DashboardView';

// We need a custom fetch function that doesn't send auth tokens
// because this is a public page and the user might not be logged in.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const fetchSharedDashboard = async (id) => {
  const response = await fetch(`${API_URL}/shared/dashboard/${id}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Dashboard not found");
    throw new Error("Failed to load dashboard");
  }
  return response.json();
};

export default function SharedDashboard() {
  const { id } = useParams();
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await fetchSharedDashboard(id);
        setReportData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadDashboard();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-signal/20 border-t-signal rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6">
        <div className="text-center bg-surface border border-border p-8 rounded-card max-w-md w-full">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">!</span>
          </div>
          <h2 className="text-ink font-mono text-xl mb-2">Error Loading Dashboard</h2>
          <p className="text-muted text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-ink font-sans">
      {/* Subtle branding header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-ink font-mono font-bold tracking-tight text-lg">
            <div className="w-2 h-2 rounded-full bg-signal shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            DARELM
          </div>
          <div className="text-sm text-muted font-mono bg-void border border-border px-3 py-1 rounded-full">
            Read-Only Presentation View
          </div>
        </div>
      </header>
      
      <main className="py-8">
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <DashboardView reportData={reportData} />
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Footer */}
      <footer className="mt-20 py-8 border-t border-border/50 text-center text-muted text-xs font-mono">
        Generated securely via Darelm Autonomous Data Platform
      </footer>
    </div>
  );
}
