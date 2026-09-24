import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';
import DashboardView from './DashboardView';
import ChartRenderer from './ChartRenderer';
import { FileText, Share2, Sparkles, LayoutDashboard, FileDown, MessageSquare, Timer, Clock, CheckCircle2 } from 'lucide-react';

const phases = ['goal', 'planning', 'execution', 'report'];

const formatTime = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}:${String(remMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const formatHumanDuration = (totalSeconds) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (safeSeconds === 0) return '0s';
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  if (mins === 0) return `${secs}s`;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
};

export default function AutopilotFlow() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('goal');
  const [goal, setGoal] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [executingMessage, setExecutingMessage] = useState('');
  const [userFeedback, setUserFeedback] = useState('');
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [viewMode, setViewMode] = useState('report');
  const addToast = useToastStore((state) => state.addToast);
  const { id } = useParams();

  // Execution-aware count-up timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isExecuting, setIsExecuting] = useState(true);
  const startTimeRef = useRef(null);
  const accumulatedSecondsRef = useRef(0);

  // Background-aware count-up timer:
  // ONLY counts when actively executing analysis in the background
  useEffect(() => {
    let interval = null;

    if (phase === 'execution' && isExecuting) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      interval = setInterval(() => {
        const now = Date.now();
        const currentSegment = Math.floor((now - startTimeRef.current) / 1000);
        setElapsedSeconds(accumulatedSecondsRef.current + currentSegment);
      }, 1000);
    } else {
      if (startTimeRef.current) {
        const now = Date.now();
        const currentSegment = Math.floor((now - startTimeRef.current) / 1000);
        accumulatedSecondsRef.current += currentSegment;
        startTimeRef.current = null;
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, isExecuting]);

  // Sync with session timestamp if recovering an ongoing execution
  useEffect(() => {
    if (phase === 'execution' && sessionId && accumulatedSecondsRef.current === 0 && !startTimeRef.current) {
      api.autopilotGetSession(sessionId).then((data) => {
        if (data?.created_at && !data.report) {
          const pastSeconds = Math.max(0, Math.floor((Date.now() - new Date(data.created_at).getTime()) / 1000));
          if (pastSeconds > 0) {
            accumulatedSecondsRef.current = pastSeconds;
            startTimeRef.current = Date.now();
            setElapsedSeconds(pastSeconds);
          }
        }
      }).catch(() => {});
    }
  }, [phase, sessionId]);

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchSession = async () => {
        try {
          const data = await api.autopilotGetSession(id);
          setSessionId(data.id);
          setGoal(data.goal);
          setSelectedDatasetId(data.dataset_id);
          setPlanData(data.plan);
          
          if (data.report) {
            setReportData(data.report);
            setPhase('report');
            setIsExecuting(false);

            const pastDuration = data.report.execution_time_seconds || 
              (data.created_at && data.updated_at ? Math.max(1, Math.round((new Date(data.updated_at) - new Date(data.created_at)) / 1000)) : 0);
            setElapsedSeconds(pastDuration);
            accumulatedSecondsRef.current = pastDuration;
          } else if (data.status === 'executing' || data.status === 'failed') {
            setPhase('execution');
            setExecutingMessage(data.status === 'failed'
              ? 'Session was interrupted. Click Resume Execution to complete synthesis.'
              : 'Session is currently executing or waiting to finish.');

            const elapsed = data.created_at 
              ? Math.max(0, Math.floor((Date.now() - new Date(data.created_at)) / 1000))
              : 0;
            setElapsedSeconds(elapsed);
            accumulatedSecondsRef.current = elapsed;
            startTimeRef.current = Date.now();
            setIsExecuting(data.status === 'executing');
            
            if (data.steps && data.steps.length > 0) {
              const completedIdxs = data.steps
                .filter(s => s.status === 'completed')
                .map(s => s.step_index - 1);
              setCompletedSteps(completedIdxs);
              
              if (completedIdxs.length > 0) {
                setCurrentStep(Math.max(...completedIdxs) + 1);
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch autopilot session:', error);
          addToast('Failed to load past session', 'error');
        }
      };
      fetchSession();
    }
  }, [id]);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const data = await api.getDatasets();
        setDatasets(data);
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
      }
    };

    fetchDatasets();
  }, []);

  const steps = planData?.steps || [];

  const handleAnalyze = async () => {
    if (!goal.trim()) {
      addToast('Please enter a goal', 'error');
      return;
    }
    
    if (!selectedDatasetId) {
      addToast('Please select a dataset', 'error');
      return;
    }
    
    setPhase('planning');
    
    try {
      const response = await api.autopilotStart({
        goal,
        dataset_id: selectedDatasetId,
      });
      setSessionId(response.session_id);
      setPlanData(response.plan);
    } catch (error) {
      console.error('Analysis failed:', error);
      addToast('Failed to start analysis: ' + error.message, 'error');
      setPhase('goal');
    }
  };

  const handleConfirmPlan = () => {
    setIsConfirming(true);
    setPhase('execution');
    setIsExecuting(true);
    startTimeRef.current = Date.now();
    
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/agents/02/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId, user_feedback: userFeedback })
    }).then(async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep incomplete chunk in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (typeof data.elapsed_seconds === 'number') {
                accumulatedSecondsRef.current = data.elapsed_seconds;
                startTimeRef.current = Date.now();
                setElapsedSeconds(data.elapsed_seconds);
              }

              if (data.status === 'executing_step') {
                setCurrentStep(data.step - 1); // 0-indexed for UI
                setExecutingMessage(data.message);
                setIsExecuting(true);
              } else if (data.status === 'step_complete') {
                if (data.step?.step_id) {
                  setCompletedSteps(prev => [...prev, data.step.step_id - 1]);
                }
              } else if (data.status === 'synthesizing') {
                setExecutingMessage(data.message);
                setIsExecuting(true);
              } else if (data.status === 'completed') {
                setIsExecuting(false);
                const finalDuration = typeof data.elapsed_seconds === 'number'
                  ? data.elapsed_seconds
                  : (accumulatedSecondsRef.current + (startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0));
                
                const finalReport = {
                  ...data.report,
                  execution_time_seconds: data.report?.execution_time_seconds || finalDuration
                };
                setElapsedSeconds(finalDuration);
                setReportData(finalReport);
                setPhase('report');
              } else if (data.status === 'error') {
                setIsExecuting(false);
                addToast(data.message, 'error');
                setPhase('planning');
                setIsConfirming(false);
              }
            } catch (e) {
              console.error("Failed to parse SSE", e);
            }
          }
        }
      }
    }).catch(async (err) => {
      console.error(err);
      setIsExecuting(false);
      setIsConfirming(false);
      try {
        const check = await api.autopilotGetSession(sessionId);
        if (check?.report) {
          setReportData(check.report);
          setPhase('report');
          addToast('Analysis completed successfully!', 'success');
          return;
        }
      } catch (e) {}
      addToast('Connection interrupted. Click Resume Execution to complete synthesis.', 'error');
      setPhase('execution');
      setExecutingMessage('Session was interrupted. Click Resume Execution to complete synthesis.');
    });
  };

  const handleExport = async (format) => {
    if (!sessionId) {
      addToast('No session to export', 'error');
      return;
    }
    try {
      const url = await api.autopilotExport(sessionId, format);
      window.open(url, '_blank');
      addToast(`Exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      addToast('Failed to export: ' + error.message, 'error');
    }
  };

  const renderPhase = () => {
    switch (phase) {
      case 'goal':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Describe your analytical goal</h2>
            <p className="text-muted mb-6">
              What do you want to analyze? Be as specific as possible.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Dataset</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors"
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map((dataset) => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Goal</label>
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Analyze Q1 sales performance by region and identify top-performing products..."
                  className="w-full h-48 bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={handleAnalyze} disabled={!goal.trim() || !selectedDatasetId}>
                  Analyze
                </Button>
              </div>
            </div>
          </div>
        );

      case 'planning':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Analysis Plan</h2>
            {!planData ? (
              <p className="text-muted mb-6">Agent is creating a step-by-step plan...</p>
            ) : (
              <>
                <p className="text-muted mb-3">Review the plan below before execution begins.</p>
                <div className="flex items-center gap-2 text-xs font-mono text-muted mb-6 bg-surface p-3 rounded-card border border-border/60">
                  <Clock size={14} className="text-muted shrink-0" />
                  <span>Timer will start counting once you confirm and run analysis.</span>
                </div>
                
                {planData.checkpoint_question && (
                  <div className="bg-surface-raised border border-warn rounded-card p-4 mb-6">
                    <span className="font-mono text-warn text-sm block mb-2">QUESTION FROM AGENT</span>
                    <p className="text-ink">{planData.checkpoint_question}</p>
                  </div>
                )}
                
                <div className="space-y-3 mb-8">
                  {steps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-4 bg-surface border border-border rounded-card"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-muted text-sm">{String(index + 1).padStart(2, '0')}</span>
                        <span className="text-ink font-medium">{step.title}</span>
                      </div>
                      <p className="text-muted text-sm ml-8">{step.description}</p>
                    </motion.div>
                  ))}
                </div>
                
                <div className="mb-8">
                  <label className="block text-sm text-muted mb-2 font-mono">Any feedback or changes to this plan?</label>
                  <textarea
                    value={userFeedback}
                    onChange={(e) => setUserFeedback(e.target.value)}
                    placeholder="e.g. Please focus more on X, or ignore Y..."
                    className="w-full bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors min-h-[100px] resize-none"
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button variant="primary" size="md" onClick={handleConfirmPlan} disabled={isConfirming}>
                    {isConfirming ? 'Starting...' : 'Confirm & Run Analysis'}
                  </Button>
                </div>
              </>
            )}
          </div>
        );

      case 'execution': {
        const isPausedOrError = executingMessage.includes('interrupted') || executingMessage.includes('failed') || !isExecuting;
        const percentComplete = steps.length > 0 ? Math.round((completedSteps.length / steps.length) * 100) : 0;

        return (
          <div className="max-w-2xl mx-auto">
            {/* Live Count-Up Timer & Execution Cockpit */}
            <div className="bg-surface border border-border rounded-card p-6 mb-8 shadow-sm relative overflow-hidden">
              {/* Subtle ambient glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-signal/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                {/* Timer Section */}
                <div className="text-center sm:text-left">
                  <div className="flex items-center gap-2 mb-1.5 justify-center sm:justify-start">
                    <span className="relative flex h-2.5 w-2.5">
                      {isExecuting ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-signal"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warn"></span>
                      )}
                    </span>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted font-medium">
                      {isExecuting ? 'Agent Active • Elapsed Time' : 'Execution Paused'}
                    </span>
                  </div>

                  <div className="font-mono text-4xl sm:text-5xl font-bold text-ink tracking-tight flex items-baseline gap-2 justify-center sm:justify-start">
                    <span>{formatTime(elapsedSeconds)}</span>
                    <span className="text-xs font-mono text-muted uppercase tracking-normal font-normal">
                      ({formatHumanDuration(elapsedSeconds)})
                    </span>
                  </div>

                  <p className="text-muted text-xs mt-1.5">
                    {isExecuting
                      ? 'Working on analytical problem in secure sandbox...'
                      : 'Execution paused. Not counting background time.'}
                  </p>
                </div>

                {/* Live Progress Cockpit */}
                <div className="w-full sm:w-64 bg-surface-raised/40 border border-border/60 rounded-card p-4">
                  <div className="flex justify-between items-center text-xs font-mono mb-2">
                    <span className="text-muted">Progress</span>
                    <span className="text-signal font-semibold">
                      {completedSteps.length} of {steps.length} steps ({percentComplete}%)
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-void rounded-full h-2 overflow-hidden mb-2.5 border border-border/40">
                    <motion.div
                      className="bg-signal h-full rounded-full"
                      initial={false}
                      animate={{ width: `${percentComplete}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted font-mono truncate">
                    <span className="shrink-0 text-signal">↳</span>
                    <span className="truncate" title={executingMessage || 'Running analysis code in sandbox...'}>
                      {executingMessage || 'Running analysis code in sandbox...'}
                    </span>
                  </div>
                </div>
              </div>

              {isPausedOrError && (
                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                  <span className="text-xs text-warn font-mono">Execution stopped or interrupted</span>
                  <Button variant="primary" size="sm" onClick={handleConfirmPlan}>
                    Resume Execution
                  </Button>
                </div>
              )}
            </div>

            {/* Title and subheader */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-mono text-xl text-ink font-semibold">Executing analysis</h2>
                <p className="text-muted font-mono text-xs">{executingMessage || 'Running analysis code in sandbox...'}</p>
              </div>
            </div>

            {/* Step list */}
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isCompleted = completedSteps.includes(index);
                const isActive = index === currentStep && isExecuting;
                const isPending = index > currentStep || (!isExecuting && !isCompleted);

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-card border transition-all duration-300 ${
                      isActive
                        ? 'bg-surface-raised border-signal border-l-4 shadow-sm'
                        : isCompleted
                        ? 'bg-surface border-border opacity-70'
                        : 'bg-surface border-border opacity-40'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isActive && (
                          <motion.span
                            animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
                            transition={{ duration: 1.2, repeat: Infinity }}
                            className="inline-block w-2.5 h-2.5 bg-signal rounded-full"
                          />
                        )}
                        {isCompleted && <span className="text-signal font-bold">✓</span>}
                        {isPending && <span className="text-muted">○</span>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink font-medium">{step.title}</span>
                          {isActive && (
                            <span className="text-[11px] font-mono text-signal bg-signal/10 px-2 py-0.5 rounded-full border border-signal/20 shrink-0">
                              Running...
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[11px] font-mono text-muted shrink-0">
                              Done
                            </span>
                          )}
                        </div>
                        {(isActive || isCompleted) && (
                          <div className="text-muted text-sm mt-1 leading-relaxed">{step.description}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      }

      case 'report':
        if (!reportData) return <div className="max-w-4xl mx-auto text-center mt-20"><p className="text-muted">Loading report...</p></div>;
        
        if (viewMode === 'dashboard') {
          return (
            <div className="relative pb-8">
              <DashboardView reportData={reportData} />
              
              <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8">
                <div className="flex flex-col sm:flex-row gap-3 justify-end items-center bg-surface-raised/20 p-4 sm:p-6 rounded-card border border-border/40">
                  <Button variant="ghost" size="md" className="w-full sm:w-auto justify-center flex items-center gap-2" onClick={() => setViewMode('report')}>
                    <FileText size={18} /> View as Report
                  </Button>
                  <Button variant="outline" size="md" className="w-full sm:w-auto justify-center flex items-center gap-2" onClick={() => {
                    const url = `${window.location.origin}/shared/dashboard/${sessionId}`;
                    navigator.clipboard.writeText(url);
                    addToast('Dashboard link copied to clipboard!', 'success');
                  }}>
                    <Share2 size={18} /> Share Dashboard
                  </Button>
                  <Button variant="primary" size="md" className="w-full sm:w-auto justify-center flex items-center gap-2" onClick={() => {
                    setPhase('goal');
                    setSessionId(null);
                    setElapsedSeconds(0);
                    accumulatedSecondsRef.current = 0;
                    startTimeRef.current = null;
                    setIsExecuting(false);
                    navigate('/session/new?agent=02');
                  }}>
                    <Sparkles size={18} /> New Analysis
                  </Button>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="max-w-4xl mx-auto px-0 sm:px-4">
            <div className="mb-8 text-center sm:text-left">
              <h2 className="font-sans text-xl sm:text-3xl font-bold text-ink leading-tight mb-3">
                {reportData.title || 'Analysis Report'}
              </h2>

              {/* Execution Duration & Step Metrics Badge Row */}
              <div className="flex flex-wrap items-center gap-2.5 justify-center sm:justify-start">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-signal/10 border border-signal/20 text-signal font-mono text-xs font-semibold">
                  <Timer size={14} />
                  <span>Completed in {formatHumanDuration(reportData.execution_time_seconds || elapsedSeconds)}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-raised border border-border text-muted font-mono text-xs">
                  <CheckCircle2 size={14} className="text-signal" />
                  <span>{steps.length || completedSteps.length || (reportData.sections ? reportData.sections.length : 0)} steps executed</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-4 sm:p-6 shadow-sm">
                <h3 className="font-mono text-base sm:text-lg text-ink mb-4 uppercase tracking-widest text-signal">Executive Summary</h3>
                <p className="text-muted leading-relaxed text-sm sm:text-base">
                  {reportData.executive_summary}
                </p>
              </div>

              {Array.isArray(reportData.sections) && reportData.sections.map((section, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-card p-4 sm:p-6 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
                    <h3 className="font-sans font-semibold text-lg sm:text-xl text-ink leading-tight">{section.heading}</h3>
                    {section.key_stat && section.key_stat !== 'N/A' && (
                      <div className="bg-signal/10 px-3 py-1.5 rounded-full border border-signal/20 shrink-0">
                        <span className="font-sans font-bold text-signal text-sm sm:text-base">{section.key_stat}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-muted mb-6 leading-relaxed text-sm sm:text-base">{section.narrative}</p>
                  
                  {section.has_chart && section.chart_spec && (
                    <div className="mt-4 rounded-card overflow-hidden border border-border bg-surface-raised/30 p-4">
                      <ChartRenderer spec={section.chart_spec} height={300} />
                    </div>
                  )}
                </div>
              ))}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Array.isArray(reportData.conclusions) && reportData.conclusions.length > 0 && (
                  <div className="bg-surface border border-border rounded-card p-6">
                    <h3 className="font-mono text-lg text-ink mb-4">Conclusions</h3>
                    <ul className="space-y-2">
                      {reportData.conclusions.map((conc, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-muted">
                          <span className="text-signal">•</span> {conc}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {Array.isArray(reportData.recommendations) && reportData.recommendations.length > 0 && (
                  <div className="bg-surface border border-border rounded-card p-6">
                    <h3 className="font-mono text-base sm:text-lg text-ink mb-4">Recommendations</h3>
                    <ul className="space-y-3">
                      {reportData.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex gap-3 text-sm sm:text-base text-muted">
                          <span className="text-signal mt-1">→</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom action row — stacked neatly on mobile, row on desktop */}
            <div className="mt-12 pt-8 flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface-raised/20 p-6 rounded-card border border-border/40">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center flex items-center gap-2"
                  onClick={() => setViewMode('dashboard')}
                >
                  <LayoutDashboard size={18} /> View Dashboard
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full sm:w-auto justify-center flex items-center gap-2"
                  onClick={() => handleExport('pdf')}
                >
                  <FileDown size={18} /> Export PDF
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto justify-center flex items-center gap-2"
                  onClick={async () => {
                    try {
                      const res = await api.handoffToAgent01(sessionId);
                      navigate(`/session/${res.session_id}?agent=01`);
                    } catch (err) {
                      console.error("Handoff failed", err);
                      addToast("Failed to handoff session to Agent 01", "error");
                    }
                  }}
                >
                  <MessageSquare size={18} /> Chat with Agent 01
                </Button>
                <Button variant="primary" size="md" className="w-full sm:w-auto justify-center flex items-center gap-2" onClick={() => {
                  setPhase('goal');
                  setSessionId(null);
                  setElapsedSeconds(0);
                  accumulatedSecondsRef.current = 0;
                  startTimeRef.current = null;
                  setIsExecuting(false);
                }}>
                  <Sparkles size={18} /> New Analysis
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-void overflow-y-auto px-4 py-8 sm:p-12">
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {renderPhase()}
        </motion.div>
      </AnimatePresence>

      {fullScreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-void/95 flex items-center justify-center p-4 cursor-zoom-out" 
          onClick={() => setFullScreenImage(null)}
        >
          <img src={fullScreenImage} className="max-w-full max-h-full object-contain rounded" />
          <button className="absolute top-6 right-6 text-muted hover:text-white bg-surface w-10 h-10 flex items-center justify-center rounded-full border border-border">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
