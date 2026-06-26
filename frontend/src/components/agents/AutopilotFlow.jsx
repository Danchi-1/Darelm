import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';

const phases = ['goal', 'planning', 'execution', 'report'];

export default function AutopilotFlow() {
  const [phase, setPhase] = useState('goal');
  const [goal, setGoal] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [datasets, setDatasets] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [reportData, setReportData] = useState(null);
  const addToast = useToastStore((state) => state.addToast);

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

  const steps = [
    'Analyze data structure and schema',
    'Identify key metrics and dimensions',
    'Generate exploratory analysis',
    'Create visualizations',
    'Compile final report',
  ];

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
      const response = await api.autopilotAnalyze({
        goal,
        dataset_id: selectedDatasetId,
      });
      setSessionId(response.session_id);
      setPhase('execution');
      executeSteps();
    } catch (error) {
      console.error('Analysis failed:', error);
      addToast('Failed to start analysis: ' + error.message, 'error');
      setPhase('goal');
    }
  };

  const executeSteps = () => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setCurrentStep(stepIndex);
        setCompletedSteps((prev) => [...prev, stepIndex]);
        stepIndex++;
      } else {
        clearInterval(interval);
        setPhase('report');
        // Fetch report data
        if (sessionId) {
          api.getSession(sessionId).then(data => {
            setReportData(data);
          }).catch(console.error);
        }
      }
    }, 1500);
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
            <h2 className="font-mono text-2xl text-ink mb-2">Planning analysis</h2>
            <p className="text-muted mb-6">Agent is creating a step-by-step plan...</p>
            <div className="space-y-3">
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.3 }}
                  className="flex items-center gap-3 p-4 bg-surface border border-border rounded-card"
                >
                  <span className="font-mono text-muted text-sm">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-ink">{step}</span>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'execution':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Executing analysis</h2>
            <p className="text-muted mb-6">Agent is working through the plan...</p>
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
                    className={`flex items-center gap-3 p-4 rounded-card border ${
                      isActive
                        ? 'bg-surface-raised border-signal border-l-4'
                        : isCompleted
                        ? 'bg-surface border-border opacity-60'
                        : 'bg-surface border-border opacity-40'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-2 h-2 bg-signal rounded-full"
                      />
                    )}
                    {isCompleted && <span className="text-signal">✓</span>}
                    {isPending && <span className="text-muted">○</span>}
                    <span className="text-ink">{step}</span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );

      case 'report':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-mono text-2xl text-ink">Analysis Report</h2>
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
                <p className="text-muted">
                  Q1 2024 sales analysis reveals strong performance across all regions, with North America
                  leading at 45% of total revenue. Key insights include a 23% increase in product A sales
                  and emerging growth in the Asia-Pacific region.
                </p>
              </div>

              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Key Metrics</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-surface-raised rounded-card p-4">
                    <span className="text-muted text-sm">Total Revenue</span>
                    <p className="font-mono text-2xl text-ink mt-1">$1.23M</p>
                  </div>
                  <div className="bg-surface-raised rounded-card p-4">
                    <span className="text-muted text-sm">Growth Rate</span>
                    <p className="font-mono text-2xl text-signal mt-1">+23%</p>
                  </div>
                  <div className="bg-surface-raised rounded-card p-4">
                    <span className="text-muted text-sm">Transactions</span>
                    <p className="font-mono text-2xl text-ink mt-1">8,432</p>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Regional Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { region: 'North America', percentage: 45, revenue: '$555K' },
                    { region: 'Europe', percentage: 30, revenue: '$370K' },
                    { region: 'Asia-Pacific', percentage: 25, revenue: '$309K' },
                  ].map((item) => (
                    <div key={item.region} className="flex items-center gap-4">
                      <span className="text-ink text-sm w-32">{item.region}</span>
                      <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted text-sm">{item.percentage}%</span>
                      <span className="font-mono text-ink text-sm">{item.revenue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
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
