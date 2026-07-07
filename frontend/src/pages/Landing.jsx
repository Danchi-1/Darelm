import { motion, useScroll, useTransform } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import TopNav from '../components/layout/TopNav';
import Footer from '../components/layout/Footer';
import { useAuthStore } from '../store/authStore';

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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
      className="relative bg-surface/50 backdrop-blur-md border border-border/50 rounded-card p-6 hover:border-signal/50 transition-all duration-300 overflow-hidden group hover:shadow-[0_0_30px_rgba(var(--color-signal),0.15)]"
      onMouseEnter={() => setShowScanLine(true)}
      onAnimationEnd={() => setShowScanLine(false)}
    >
      {showScanLine && <div className="scan-line bg-signal/20 h-full absolute top-0 w-1 shadow-[0_0_10px_rgba(var(--color-signal),0.8)]" />}
      <div className="absolute -inset-1 bg-gradient-to-r from-signal/0 via-signal/10 to-signal/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl" />
      
      <div className="relative z-10">
        <span className="font-mono text-signal text-sm">{agent.number}</span>
        <h3 className="font-mono text-xl text-ink mt-2 mb-3 tracking-tight">{agent.name}</h3>
        <p className="text-sm text-muted mb-4 leading-relaxed">{agent.description}</p>
        <ul className="space-y-3 mb-8">
          {agent.capabilities.map((capability, i) => (
            <li key={i} className="text-sm text-ink flex items-start opacity-80">
              <span className="text-signal mr-3 mt-0.5 opacity-70">✦</span>
              {capability}
            </li>
          ))}
        </ul>
        <Link to={isAuthenticated ? "/dashboard" : "/register"} className="inline-flex items-center text-signal text-sm font-medium hover:text-white transition-colors">
          Try this agent <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </motion.div>
  );
}

function WorkingProof() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Calculate which agent is active based on scroll (0, 1, or 2)
  const activeIndex = useTransform(scrollYProgress, [0, 0.33, 0.66, 1], [0, 1, 2, 2]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    return activeIndex.onChange((v) => {
      setCurrentIdx(Math.floor(v));
    });
  }, [activeIndex]);

  const proofData = [
    {
      agent: "Conversational Analyst",
      qImg: "/assets/proof/agent1-question.webp",
      rImg: "/assets/proof/agent1-reply.webp",
    },
    {
      agent: "Autopilot Analyst",
      qImg: "/assets/proof/agent2-question.webp",
      rImg: "/assets/proof/agent2-reply.webp",
    },
    {
      agent: "ML Experimenter",
      qImg: "/assets/proof/agent3-question.webp",
      rImg: "/assets/proof/agent3-reply.webp",
    }
  ];

  return (
    <section ref={containerRef} className="relative h-[300vh] bg-void">
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-signal/5 via-void to-void" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-mono text-3xl text-ink mb-4">See it in action</h2>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              Scroll to see how each agent processes complex requests and delivers actionable insights in seconds.
            </p>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 h-[60vh]">
            {/* Left side: Question */}
            <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-md aspect-video rounded-xl border border-white/10 bg-surface/50 backdrop-blur shadow-2xl overflow-hidden flex items-center justify-center">
                {proofData.map((data, idx) => (
                  <motion.div
                    key={`q-${idx}`}
                    className="absolute inset-0 w-full h-full p-4 flex flex-col justify-center"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ 
                      opacity: currentIdx === idx ? 1 : 0,
                      scale: currentIdx === idx ? 1 : 0.95,
                      pointerEvents: currentIdx === idx ? 'auto' : 'none'
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="text-xs font-mono text-signal mb-2 text-center md:text-left">Prompt for {data.agent}</span>
                    <div className="w-full h-full bg-white/5 rounded flex items-center justify-center relative overflow-hidden group">
                       <img 
                        src={data.qImg} 
                        alt={`Question for ${data.agent}`} 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full h-full object-cover absolute inset-0 z-10" 
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
                       />
                       <div className="text-muted/50 font-mono text-sm hidden absolute inset-0 flex-col items-center justify-center z-0">
                         <span>Waiting for image:</span>
                         <span className="text-xs">{data.qImg}</span>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right side: Reply */}
            <div className="w-full md:w-1/2 h-full flex flex-col items-center justify-center">
              <div className="relative w-full max-w-xl aspect-[4/3] rounded-xl border border-white/10 bg-surface/50 backdrop-blur shadow-2xl overflow-hidden flex items-center justify-center">
                {proofData.map((data, idx) => (
                   <motion.div
                   key={`r-${idx}`}
                   className="absolute inset-0 w-full h-full p-4 flex flex-col justify-center"
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ 
                     opacity: currentIdx === idx ? 1 : 0,
                     x: currentIdx === idx ? 0 : 20,
                     pointerEvents: currentIdx === idx ? 'auto' : 'none'
                   }}
                   transition={{ duration: 0.5, delay: 0.1 }}
                 >
                   <span className="text-xs font-mono text-signal mb-2 text-center md:text-left">Reply from {data.agent}</span>
                   <div className="w-full h-full bg-white/5 rounded flex items-center justify-center relative overflow-hidden group">
                      <img 
                        src={data.rImg} 
                        alt={`Reply from ${data.agent}`} 
                        loading="lazy" 
                        decoding="async" 
                        className="w-full h-full object-cover absolute inset-0 z-10" 
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} 
                      />
                      <div className="text-muted/50 font-mono text-sm hidden absolute inset-0 flex-col items-center justify-center z-0">
                         <span>Waiting for image:</span>
                         <span className="text-xs">{data.rImg}</span>
                      </div>
                   </div>
                 </motion.div>
                ))}
              </div>
            </div>
          </div>
          
          {/* Scroll progress indicator */}
          <div className="mt-12 flex justify-center gap-4">
            {proofData.map((_, idx) => (
              <div key={idx} className="h-1 w-12 rounded-full bg-surface relative overflow-hidden">
                <motion.div 
                  className="absolute inset-0 bg-signal" 
                  initial={{ x: '-100%' }}
                  animate={{ x: currentIdx === idx ? '0%' : currentIdx > idx ? '100%' : '-100%' }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}

function BentoGrid() {
  return (
    <section className="py-32 px-6 relative overflow-hidden bg-void">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-signal/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-mono text-4xl text-ink tracking-tight mb-4">Enterprise-grade infrastructure</h2>
          <p className="text-muted text-lg">Built for scale, security, and uncompromising performance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[240px]">
          {/* Large Card */}
          <div className="md:col-span-2 md:row-span-2 bg-surface/40 backdrop-blur border border-white/10 rounded-2xl p-8 flex flex-col justify-end relative overflow-hidden group hover:bg-surface/60 transition-colors">
            <div className="absolute inset-0 bg-gradient-to-br from-signal/5 to-transparent pointer-events-none" />
            <div className="absolute top-8 right-8 w-24 h-24 bg-signal/20 rounded-full blur-2xl group-hover:bg-signal/40 transition-colors duration-500" />
            <h3 className="font-mono text-2xl text-ink mb-2">Isolated Python Sandbox</h3>
            <p className="text-muted max-w-md">Every AI operation runs in a secure, ephemeral E2B sandbox environment. No risks to your underlying infrastructure.</p>
          </div>

          {/* Medium Card */}
          <div className="bg-surface/40 backdrop-blur border border-white/10 rounded-2xl p-8 flex flex-col justify-center relative group hover:bg-surface/60 transition-colors">
            <h3 className="font-mono text-xl text-ink mb-2">Any Data Source</h3>
            <p className="text-sm text-muted">CSV, Excel, Postgres, MySQL, or public APIs.</p>
          </div>

          {/* Medium Card */}
          <div className="bg-surface/40 backdrop-blur border border-white/10 rounded-2xl p-8 flex flex-col justify-center relative group hover:bg-surface/60 transition-colors">
            <h3 className="font-mono text-xl text-ink mb-2">Auto-Scaling</h3>
            <p className="text-sm text-muted">Powered by Alibaba Cloud and Docker.</p>
          </div>

          {/* Wide Card */}
          <div className="md:col-span-3 bg-gradient-to-r from-signal/10 to-surface/40 backdrop-blur border border-white/10 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-8 group hover:border-signal/30 transition-colors">
            <div>
              <h3 className="font-mono text-2xl text-ink mb-2">Powered entirely by Qwen</h3>
              <p className="text-muted max-w-xl">Leveraging Qwen-Plus for advanced reasoning, Qwen-Coder for precise execution, and Qwen-Max for complex ML tasks.</p>
            </div>
            <div className="flex gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-signal font-mono text-xl animate-pulse">QP</div>
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-signal font-mono text-xl animate-pulse delay-75">QC</div>
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-signal font-mono text-xl animate-pulse delay-150">QM</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const [gridOffset, setGridOffset] = useState(0);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    const handleScroll = () => {
      setGridOffset(window.scrollY * 0.1);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-void text-ink font-sans">
      {/* Hero Section */}
      <section className="relative h-screen coordinate-grid overflow-hidden" style={{ transform: `translateY(${gridOffset}px)` }}>
        <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" />
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-signal/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
        
        <div className="relative z-10">
          <TopNav />
          <div className="max-w-6xl mx-auto px-6 pt-24 pb-12 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse" />
              <span className="font-mono text-signal text-xs tracking-[0.1em] uppercase">Darelm Intelligence Engine V1.0</span>
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
              className="font-mono text-6xl md:text-7xl lg:text-8xl text-ink text-center leading-tight mb-6 tracking-tighter"
            >
              Your data.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-signal via-blue-400 to-signal">Fully understood.</span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
              className="text-lg md:text-xl text-muted text-center max-w-2xl mb-10 leading-relaxed"
            >
              Upload a dataset, connect a database, or describe an ML problem. Darelm's autonomous agents handle the rest — analysis, modeling, and insight, end to end.
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
              className="flex gap-4"
            >
              <Link to={isAuthenticated ? "/dashboard" : "/register"}>
                <Button variant="primary" size="lg" className="shadow-[0_0_20px_rgba(var(--color-signal),0.3)] hover:shadow-[0_0_30px_rgba(var(--color-signal),0.5)] transition-shadow">
                  Start analyzing
                </Button>
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6, ease: 'easeOut' }}
              className="absolute bottom-12 flex flex-col items-center gap-2"
            >
              <span className="text-muted text-sm font-mono tracking-widest uppercase text-xs">Scroll to explore</span>
              <div className="w-px h-12 bg-gradient-to-b from-signal/50 to-transparent" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section id="agents" className="py-32 px-6 relative z-10 bg-void">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 text-center md:text-left">
             <h2 className="font-mono text-3xl md:text-4xl text-ink mb-4">Three dedicated specialists.</h2>
             <p className="text-muted text-lg max-w-2xl">A team of AI agents designed to tackle any data challenge, from simple queries to predictive modeling.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((agent, index) => (
              <AgentCard key={agent.number} agent={agent} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Working Proof Section */}
      <WorkingProof />

      {/* Bento Grid */}
      <BentoGrid />

      <Footer />
    </div>
  );
}
