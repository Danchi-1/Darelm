import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';

const TIMER_MINUTES = 5;
const TIMER_SECONDS = TIMER_MINUTES * 60;

export default function MLExperimenter() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('hypothesis');
  const [hypothesis, setHypothesis] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  
  // Plan Phase
  const [planData, setPlanData] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  
  // Execution Phase
  const [timeRemaining, setTimeRemaining] = useState(TIMER_SECONDS);
  const [executingMessage, setExecutingMessage] = useState('');
  const [completedSteps, setCompletedSteps] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [completionStatus, setCompletionStatus] = useState(null);
  
  const addToast = useToastStore((state) => state.addToast);
  const { id } = useParams();

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

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchSession = async () => {
        try {
          const data = await api.mlGetSession(id);
          setSessionId(data.id);
          setHypothesis(data.hypothesis);
          setPlanData(data.plan);
          if (data.status === 'planning') setPhase('plan');
          else if (data.status === 'executing') setPhase('execution');
          else if (data.status === 'completed' || data.status === 'partial') {
            setReportData(data.report);
            setCompletionStatus(data.status);
            setPhase('results');
          }
        } catch (error) {
          console.error(error);
          navigate('/session/new?agent=03');
        }
      };
      fetchSession();
    }
  }, [id, navigate]);

  // Timer logic for execution phase
  useEffect(() => {
    let timer;
    if (phase === 'execution' && timeRemaining > 0) {
      timer = setInterval(() => {
        setTimeRemaining((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [phase, timeRemaining]);

  const handleStart = async () => {
    if (!hypothesis.trim() || !selectedDatasetId) return;
    setIsPlanning(true);
    try {
      const response = await api.mlStartSession({
        hypothesis,
        dataset_id: selectedDatasetId,
      });
      setSessionId(response.session_id);
      setPlanData(response.plan);
      setPhase('plan');
      navigate(`/session/${response.session_id}?agent=03`, { replace: true });
    } catch (error) {
      console.error(error);
      addToast('Failed to generate plan', 'error');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecute = () => {
    setPhase('execution');
    setTimeRemaining(TIMER_SECONDS);
    
    // Connect to SSE
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    
    fetch(`${API_BASE}/agents/03/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ session_id: sessionId })
    }).then(async response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); 

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.status === 'executing_step') {
                setExecutingMessage(`Executing step ${data.step.step_id}: ${data.step.title}`);
                if (data.step.status === 'completed') {
                  setCompletedSteps(prev => [...prev, data.step.step_id]);
                }
              } else if (data.status === 'thought') {
                setExecutingMessage(data.content || "Agent is thinking and analyzing...");
              } else if (data.status === 'synthesizing') {
                setExecutingMessage(data.message);
              } else if (data.status === 'completed') {
                setReportData(data.report);
                setCompletionStatus(data.completion_status);
                setPhase('results');
              } else if (data.status === 'error') {
                addToast(data.message, 'error');
                setPhase('plan');
              }
            } catch (e) {
              console.error("Failed to parse SSE", e);
            }
          }
        }
      }
    }).catch(err => {
      console.error(err);
      addToast('Execution failed', 'error');
      setPhase('plan');
    });
  };

  const handleExport = (format) => {
    addToast('Export not implemented yet', 'info');
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderPhase = () => {
    switch (phase) {
      case 'hypothesis':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">ML Experimenter</h2>
            <p className="text-muted mb-6">Describe your hypothesis. The agent has exactly 5 minutes to experiment.</p>
            
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
                <label className="block text-sm text-muted mb-2">Hypothesis / Goal</label>
                <textarea
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="e.g., Predict customer churn using logistic regression..."
                  className="w-full h-32 bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={handleStart} disabled={!hypothesis.trim() || !selectedDatasetId || isPlanning}>
                  {isPlanning ? 'Planning...' : 'Generate Plan'}
                </Button>
              </div>
            </div>
          </div>
        );

      case 'plan':
        if (!planData) return null;
        return (
          <div className="max-w-3xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Feasibility Plan</h2>
            <p className="text-muted mb-6">The agent has planned the following approach within the 5-minute budget.</p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-surface border border-border rounded-card p-4">
                <span className="text-xs text-muted block mb-1">Task Type</span>
                <span className="font-mono text-signal">{planData.ml_task_type}</span>
              </div>
              <div className="bg-surface border border-border rounded-card p-4">
                <span className="text-xs text-muted block mb-1">5-Min Feasibility</span>
                <Badge variant={planData.feasibility_in_budget === 'unlikely' ? 'error' : planData.feasibility_in_budget === 'partial' ? 'warning' : 'success'}>
                  {planData.feasibility_in_budget.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="bg-surface-raised border border-border rounded-card p-5 mb-6 text-sm text-ink">
              <strong>Feasibility Note:</strong> {planData.feasibility_note}
              <br /><br />
              <strong>Fallback Plan:</strong> {planData.fallback_plan}
            </div>

            <div className="space-y-3 mb-8">
              {planData.prioritized_steps?.map((step) => (
                <div key={step.id} className="p-4 bg-surface border border-border rounded-card flex justify-between items-center">
                  <div>
                    <span className="text-ink font-medium block">{step.title}</span>
                    <span className="text-muted text-sm">{step.description}</span>
                  </div>
                  <Badge variant={step.priority === 'essential' ? 'success' : 'neutral'}>{step.priority}</Badge>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setPhase('hypothesis')}>Edit Goal</Button>
              <Button variant="primary" size="md" onClick={handleExecute}>
                Start 5-Minute Execution
              </Button>
            </div>
          </div>
        );

      case 'execution':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Executing Experiment</h2>
            
            <div className="bg-surface border border-border rounded-card p-8 text-center mb-8">
              <div className="font-mono text-5xl mb-4" style={{ color: timeRemaining < 60 ? '#ef4444' : '#22c55e' }}>
                {formatTime(timeRemaining)}
              </div>
              <p className="text-muted text-sm uppercase tracking-wider">Remaining Budget</p>
            </div>
            
            <div className="bg-surface-raised border border-border rounded-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="animate-spin h-4 w-4 border-2 border-signal border-t-transparent rounded-full"></span>
                <span className="text-ink font-mono text-sm">
                  {executingMessage || "Initializing sandbox environment..."}
                </span>
              </div>
              
              <div className="space-y-2 mt-6">
                {planData?.prioritized_steps?.map((step) => {
                  const isCompleted = completedSteps.includes(step.id);
                  return (
                    <div key={step.id} className={`p-3 rounded border text-sm transition-colors ${
                      isCompleted ? 'bg-signal-dim border-signal text-ink' : 'bg-surface border-border text-muted'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span>{step.title}</span>
                        {isCompleted && <span className="text-signal">✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        );

      case 'results':
        if (!reportData) return null;
        return (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-mono text-2xl text-ink">{reportData.title}</h2>
              <Badge variant={completionStatus === 'partial' ? 'warning' : 'success'}>
                {completionStatus === 'partial' ? 'PARTIAL RESULT (TIMEOUT)' : 'COMPLETED'}
              </Badge>
            </div>

            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Executive Summary</h3>
                <p className="text-muted leading-relaxed">{reportData.executive_summary}</p>
              </div>

              {reportData.sections?.map((section, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-card p-6">
                  <h3 className="font-mono text-lg text-ink mb-4">{section.heading}</h3>
                  <p className="text-muted text-sm leading-relaxed mb-4">{section.narrative}</p>
                  {section.key_metric && (
                    <div className="bg-surface-raised p-4 rounded inline-block">
                      <span className="font-mono text-signal font-medium">{section.key_metric}</span>
                    </div>
                  )}
                </div>
              ))}

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-card p-6">
                  <h3 className="font-mono text-sm text-ink mb-3 uppercase tracking-wider">Limitations</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                    {reportData.limitations?.map((lim, i) => <li key={i}>{lim}</li>)}
                  </ul>
                </div>
                <div className="bg-surface border border-border rounded-card p-6">
                  <h3 className="font-mono text-sm text-ink mb-3 uppercase tracking-wider">Recommendations</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted">
                    {reportData.recommendations?.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <Button variant="primary" size="md" onClick={() => {
                setPhase('hypothesis');
                setSessionId(null);
                navigate('/session/new?agent=03');
              }}>
                New experiment
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen bg-void overflow-y-auto p-12">
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
    </div>
  );
}
