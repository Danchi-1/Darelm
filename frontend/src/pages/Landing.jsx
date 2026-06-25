import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import TopNav from '../components/layout/TopNav';
import Footer from '../components/layout/Footer';

const agents = [
  {
    number: '01',
    name: 'Conversational Analyst',
    description: 'Ask questions about your data in plain language. Get precise answers, charts, and tables.',
    capabilities: [
      'Natural language to SQL and Python',
      'Auto-generated charts and tables',
      'Multi-turn context awareness',
      'CSV, Excel, PostgreSQL, MySQL, SQLite',
    ],
  },
  {
    number: '02',
    name: 'Autopilot Analyst',
    description: 'Describe an analytical goal. The agent plans, executes, and delivers a complete report.',
    capabilities: [
      'Autonomous multi-step analysis planning',
      'Self-correcting execution loop',
      'Structured report with downloadable PDF/CSV',
      'Human-in-the-loop checkpoints',
    ],
  },
  {
    number: '03',
    name: 'ML Experimenter',
    description: 'State a modeling question or research hypothesis. The agent preprocesses, trains, and evaluates.',
    capabilities: [
      'Automatic preprocessing and feature engineering',
      'Model selection based on your goal',
      'Full evaluation report with metrics',
      'Plain language interpretation of results',
    ],
  },
];

function AgentCard({ agent, index }) {
  const [showScanLine, setShowScanLine] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="relative bg-surface border border-border rounded-card p-6 hover:border-signal transition-colors duration-200 overflow-hidden group"
      onMouseEnter={() => setShowScanLine(true)}
      onAnimationEnd={() => setShowScanLine(false)}
    >
      {showScanLine && <div className="scan-line" />}
      <span className="font-mono text-muted text-sm">{agent.number}</span>
      <h3 className="font-mono text-lg text-ink mt-2 mb-3">{agent.name}</h3>
      <p className="text-sm text-muted mb-4">{agent.description}</p>
      <ul className="space-y-2 mb-6">
        {agent.capabilities.map((capability, i) => (
          <li key={i} className="text-sm text-ink flex items-start">
            <span className="text-signal mr-2">•</span>
            {capability}
          </li>
        ))}
      </ul>
      <Link to="/register" className="text-signal text-sm font-medium hover:opacity-80 transition-opacity">
        Try this agent →
      </Link>
    </motion.div>
  );
}

export default function Landing() {
  const [gridOffset, setGridOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setGridOffset(window.scrollY * 0.1);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeInUp = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, ease: 'easeOut' },
  };

  return (
    <div className="min-h-screen bg-void">
      {/* Hero Section */}
      <section className="relative h-screen coordinate-grid overflow-hidden" style={{ transform: `translateY(${gridOffset}px)` }}>
        <div className="absolute inset-0 bg-void/90" />
        <div className="relative z-10">
          <TopNav />
          <div className="max-w-6xl mx-auto px-6 pt-24 pb-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="font-mono text-signal text-xs tracking-[0.15em] mb-6"
            >
              POWERED BY QWEN CLOUD
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
              className="font-mono text-6xl text-ink text-center leading-tight mb-6"
            >
              Your data.
              <br />
              Fully understood.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.16, ease: 'easeOut' }}
              className="text-base text-muted text-center max-w-2xl mb-8"
            >
              Upload a dataset, connect a database, or describe an ML problem. Darelm's agents handle the rest — analysis, modeling, and insight, end to end.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.24, ease: 'easeOut' }}
              className="flex gap-4"
            >
              <Link to="/register">
                <Button variant="primary" size="lg">
                  Start analyzing
                </Button>
              </Link>
              <Link to="/how-it-works">
                <Button variant="ghost" size="lg">
                  See how it works
                </Button>
              </Link>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4, ease: 'easeOut' }}
              className="absolute bottom-8"
            >
              <span className="text-muted text-2xl">↓</span>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-mono text-2xl text-ink mb-12">Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((agent, index) => (
              <AgentCard key={agent.number} agent={agent} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-surface">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-mono text-2xl text-ink mb-12">How it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                step: '01',
                title: 'Connect your data',
                description: 'Upload CSV/Excel or paste a database connection string',
              },
              {
                step: '02',
                title: 'Pick an agent',
                description: 'Choose based on what you need: a question, a full analysis, or an ML experiment',
              },
              {
                step: '03',
                title: 'Get your answer',
                description: 'Results render in the UI. Download as PDF, CSV, or JSON.',
              },
            ].map((item, index) => (
              <div key={index} className="flex flex-col">
                <span className="font-mono text-signal text-lg mb-3">{item.step}</span>
                <h3 className="font-medium text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-muted">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Qwen Section */}
      <section id="qwen" className="py-24 px-6">
        <div className="max-w-6xl mx-auto bg-surface border border-border rounded-card p-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <h2 className="font-mono text-2xl text-ink">
            Built entirely on Qwen Cloud
          </h2>
          <div className="flex flex-wrap gap-3">
            <span className="bg-signal-dim text-signal px-3 py-1 rounded-badge font-mono text-xs">
              Qwen-Plus for reasoning
            </span>
            <span className="bg-signal-dim text-signal px-3 py-1 rounded-badge font-mono text-xs">
              Qwen-Coder for execution
            </span>
            <span className="bg-signal-dim text-signal px-3 py-1 rounded-badge font-mono text-xs">
              Qwen-Max for complex ML
            </span>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
