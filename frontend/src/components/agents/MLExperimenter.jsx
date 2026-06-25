import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

export default function MLExperimenter() {
  const [phase, setPhase] = useState('hypothesis');
  const [hypothesis, setHypothesis] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [progress, setProgress] = useState(0);

  const handleStart = () => {
    if (!hypothesis.trim() || !selectedDataset) return;
    setPhase('preprocessing');
    
    setTimeout(() => {
      setPhase('model-selection');
    }, 2000);
  };

  const handleTrain = () => {
    setPhase('training');
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 5;
      setProgress(currentProgress);
      if (currentProgress >= 100) {
        clearInterval(interval);
        setPhase('results');
      }
    }, 150);
  };

  const renderPhase = () => {
    switch (phase) {
      case 'hypothesis':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">What do you want to model?</h2>
            <p className="text-muted mb-6">Describe your hypothesis or modeling question.</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">Hypothesis</label>
                <textarea
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  placeholder="e.g., Predict customer churn based on usage patterns and demographics..."
                  className="w-full h-32 bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">Dataset</label>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="w-full bg-surface border border-border rounded-card p-4 text-ink focus:border-signal focus:outline-none transition-colors"
                >
                  <option value="">Select a dataset...</option>
                  <option value="customers">customers.csv</option>
                  <option value="transactions">transactions.csv</option>
                  <option value="products">products.csv</option>
                </select>
              </div>

              <div className="flex justify-end">
                <Button variant="primary" size="md" onClick={handleStart}>
                  Start experiment
                </Button>
              </div>
            </div>
          </div>
        );

      case 'preprocessing':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Preprocessing data</h2>
            <p className="text-muted mb-6">Agent is preparing your data for modeling...</p>
            
            <div className="bg-surface border border-border rounded-card p-6">
              <h3 className="font-mono text-sm text-ink mb-4">Preprocessing steps</h3>
              <div className="space-y-2">
                {[
                  'Handling missing values',
                  'Encoding categorical variables',
                  'Scaling numerical features',
                  'Feature engineering',
                ].map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.4 }}
                    className="flex items-center gap-3 text-sm text-muted"
                  >
                    <span className="text-signal">✓</span>
                    {step}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'model-selection':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Model selection</h2>
            <p className="text-muted mb-6">Agent has selected the best model for your task.</p>
            
            <div className="bg-surface border border-border rounded-card p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                <Badge variant="active">Selected</Badge>
                <h3 className="font-mono text-lg text-ink">Random Forest Classifier</h3>
              </div>
              <p className="text-muted text-sm mb-4">
                Based on your hypothesis and data characteristics, Random Forest is the optimal choice.
                It handles mixed data types well, provides feature importance, and is robust to overfitting.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted">Expected accuracy:</span>
                  <span className="font-mono text-ink ml-2">87-92%</span>
                </div>
                <div>
                  <span className="text-muted">Training time:</span>
                  <span className="font-mono text-ink ml-2">~2-3 min</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="md" onClick={handleTrain}>
                Train model
              </Button>
            </div>
          </div>
        );

      case 'training':
        return (
          <div className="max-w-2xl mx-auto">
            <h2 className="font-mono text-2xl text-ink mb-2">Training model</h2>
            <p className="text-muted mb-6">Agent is training the Random Forest classifier...</p>
            
            <div className="bg-surface border border-border rounded-card p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted">Progress</span>
                <span className="font-mono text-signal">{progress}%</span>
              </div>
              <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-signal"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <div className="mt-4 text-sm text-muted">
                {progress < 30 && 'Initializing training...'}
                {progress >= 30 && progress < 60 && 'Building decision trees...'}
                {progress >= 60 && progress < 90 && 'Optimizing hyperparameters...'}
                {progress >= 90 && 'Finalizing model...'}
              </div>
            </div>
          </div>
        );

      case 'results':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-mono text-2xl text-ink">Model Results</h2>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  Full report PDF
                </Button>
                <Button variant="ghost" size="sm">
                  Metrics CSV
                </Button>
                <Button variant="ghost" size="sm">
                  Model (.pkl)
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'Accuracy', value: '89.4%' },
                    { label: 'Precision', value: '87.2%' },
                    { label: 'Recall', value: '91.1%' },
                    { label: 'F1 Score', value: '89.1%' },
                  ].map((metric) => (
                    <div key={metric.label} className="bg-surface-raised rounded-card p-4">
                      <span className="text-muted text-xs">{metric.label}</span>
                      <p className="font-mono text-xl text-ink mt-1">{metric.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Feature Importance</h3>
                <div className="space-y-3">
                  {[
                    { feature: 'Account age', importance: 0.32 },
                    { feature: 'Monthly spend', importance: 0.28 },
                    { feature: 'Login frequency', importance: 0.21 },
                    { feature: 'Support tickets', importance: 0.12 },
                    { feature: 'Product usage', importance: 0.07 },
                  ].map((item) => (
                    <div key={item.feature} className="flex items-center gap-4">
                      <span className="text-ink text-sm w-40">{item.feature}</span>
                      <div className="flex-1 h-2 bg-surface-raised rounded-full overflow-hidden">
                        <div
                          className="h-full bg-signal"
                          style={{ width: `${item.importance * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-muted text-sm">{(item.importance * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-card p-6">
                <h3 className="font-mono text-lg text-ink mb-4">Interpretation</h3>
                <p className="text-muted text-sm leading-relaxed">
                  The model achieves 89.4% accuracy in predicting customer churn. Account age is the most
                  important predictor (32% importance), suggesting that newer customers are more likely to churn.
                  Monthly spend and login frequency are also strong indicators. The model performs well across
                  all metrics, with particularly high recall (91.1%), meaning it effectively identifies most
                  customers who will churn.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" size="md" onClick={() => setPhase('hypothesis')}>
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
