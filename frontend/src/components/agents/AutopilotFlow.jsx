import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';

const phases = ['goal', 'planning', 'execution', 'report'];

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
  const addToast = useToastStore((state) => state.addToast);
  const { id } = useParams();

  useEffect(() => {
    if (id && id !== 'new') {
      const fetchSession = async () => {
        try {
          const data = await api.autopilotGetSession(id);
          setSessionId(data.id);
          setGoal(data.goal);
          setSelectedDatasetId(data.dataset_id);
          setPlanData(data.plan);
          
          if (data.status === 'completed' && data.report) {
            setReportData(data.report);
            setPhase('report');
          } else if (data.status === 'executing') {
            setPhase('execution');
            setExecutingMessage('Session is currently executing or failed to finish cleanly.');
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
              
              if (data.status === 'executing_step') {
                setCurrentStep(data.step - 1); // 0-indexed for UI
                setExecutingMessage(data.message);
              } else if (data.status === 'step_complete') {
                setCompletedSteps(prev => [...prev, data.step.step_id - 1]);
              } else if (data.status === 'synthesizing') {
                setExecutingMessage(data.message);
              } else if (data.status === 'completed') {
                setReportData(data.report);
                setPhase('report');
              } else if (data.status === 'error') {
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
    }).catch(err => {
      console.error(err);
      addToast('Execution failed', 'error');
      setPhase('planning');
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
                <p className="text-muted mb-6">Review the plan below before execution begins.</p>
                
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

      case 'execution':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Executing analysis</h2>
            <p className="text-muted mb-6 font-mono text-sm">{executingMessage || 'Initializing...'}</p>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const isCompleted = completedSteps.includes(index);
                const isActive = index === currentStep;
                const isPending = index > currentStep;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`p-4 rounded-card border ${
                      isActive
                        ? 'bg-surface-raised border-signal border-l-4'
                        : isCompleted
                        ? 'bg-surface border-border opacity-60'
                        : 'bg-surface border-border opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isActive && (
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="w-2 h-2 bg-signal rounded-full shrink-0"
                        />
                      )}
                      {isCompleted && <span className="text-signal shrink-0">✓</span>}
                      {isPending && <span className="text-muted shrink-0">○</span>}
                      <div className="flex-1 min-w-0">
                        <div className="text-ink font-medium">{step.title}</div>
                        {(isActive || isCompleted) && (
                          <div className="text-muted text-sm mt-1">{step.description}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );

      case 'report':
        if (!reportData) return <div className="max-w-4xl mx-auto text-center mt-20"><p className="text-muted">Loading report...</p></div>;
        
        return (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-mono text-2xl text-ink">{reportData.title || 'Analysis Report'}</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => handleExport('pdf')}>
                  PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}>
                  CSV
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleExport('json')}>
                  JSON
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Executive Summary</h3>
                <p className="text-muted leading-relaxed">
                  {reportData.executive_summary}
                </p>
              </div>

              {reportData.sections && reportData.sections.map((section, idx) => (
                <div key={idx} className="bg-surface border border-border rounded-card p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-mono text-lg text-ink">{section.heading}</h3>
                    {section.key_stat && (
                      <div className="bg-surface-raised px-3 py-1 rounded-full border border-border">
                        <span className="font-mono text-signal text-sm">{section.key_stat}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-muted mb-6 leading-relaxed">{section.narrative}</p>
                  
                  {section.chart_base64 && (
                    <div className="mt-4 rounded-card overflow-hidden border border-border bg-surface-raised p-2">
                      <img src={section.chart_base64} alt={`Chart for ${section.heading}`} className="w-full h-auto object-contain max-h-96" />
                    </div>
                  )}
                </div>
              ))}
              
              <div className="grid grid-cols-2 gap-6">
                {reportData.conclusions && reportData.conclusions.length > 0 && (
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
                
                {reportData.recommendations && reportData.recommendations.length > 0 && (
                  <div className="bg-surface border border-border rounded-card p-6">
                    <h3 className="font-mono text-lg text-ink mb-4">Recommendations</h3>
                    <ul className="space-y-2">
                      {reportData.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex gap-2 text-sm text-muted">
                          <span className="text-signal">→</span> {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <Button 
                variant="outline" 
                size="md" 
                onClick={async () => {
                  try {
                    const res = await api.handoffToAgent01(sessionId);
                    navigate(`/session/${res.session_id}?agent=01`);
                  } catch (err) {
                    console.error("Handoff failed", err);
                    alert("Failed to handoff session to Agent 01");
                  }
                }}
              >
                💬 Chat with Agent 01 about this Report
              </Button>
              <Button variant="primary" size="md" onClick={() => setPhase('goal')}>
                Start new analysis
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
