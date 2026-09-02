import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Database, FileText } from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';

export default function DataCleaner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  
  const [dataset, setDataset] = useState(null);
  const [instructions, setInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [newDatasetId, setNewDatasetId] = useState(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    const fetchDataset = async () => {
      try {
        const data = await api.getDataset(id);
        setDataset(data);
      } catch (error) {
        addToast('Failed to load dataset details', 'error');
        navigate('/datasets');
      }
    };
    fetchDataset();
  }, [id, navigate, addToast]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleStartCleaning = async () => {
    if (!instructions.trim()) {
      addToast('Please enter cleaning instructions', 'error');
      return;
    }

    setIsProcessing(true);
    setLogs([{ type: 'info', content: 'Initializing Data Engineer Agent...' }]);
    setReport(null);

    try {
      const { session_id } = await api.cleanerStartSession({
        dataset_id: id,
        instructions: instructions,
      });

      api.cleanerExecuteSession(session_id).catch(err => console.error("Execution trigger failed:", err));

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const eventSource = new EventSource(`${API_BASE}/agents/04/execute`, { withCredentials: true });
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === 'thought') {
            setLogs(prev => [...prev, { type: 'thought', content: data.content }]);
          } else if (data.status === 'error') {
            setLogs(prev => [...prev, { type: 'error', content: data.message }]);
            setIsProcessing(false);
            eventSource.close();
            addToast('Cleaning failed', 'error');
          } else if (data.status === 'completed') {
            setReport(data.report);
            setNewDatasetId(data.report.new_dataset_id);
            setIsProcessing(false);
            eventSource.close();
            addToast('Dataset cleaned successfully!', 'success');
          }
        } catch (e) {
          console.error("Failed to parse SSE event:", e);
        }
      };

      eventSource.onerror = () => {
        setIsProcessing(false);
        eventSource.close();
      };
      
    } catch (error) {
      addToast(error.message || 'Failed to start cleaning session', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col p-6 max-w-7xl mx-auto gap-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/datasets')} className="text-muted">
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <h1 className="font-mono text-2xl text-ink flex items-center gap-2">
              <Database size={24} className="text-signal" />
              Data Cleaner
            </h1>
          </div>
          {dataset && (
            <div className="text-sm text-muted font-mono bg-surface border border-border px-3 py-1 rounded-full">
              Target: {dataset.name}
            </div>
          )}
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          
          {/* Left Panel: Configuration */}
          <div className="flex flex-col gap-6 min-h-0 overflow-y-auto pr-2">
            
            <div className="bg-surface border border-border rounded-card p-6 flex flex-col flex-1">
              <h2 className="font-mono text-lg text-ink mb-4 flex items-center gap-2">
                <FileText size={20} /> Cleaning Instructions
              </h2>
              <p className="text-muted text-sm mb-4">
                Describe exactly how you want this data cleaned. The AI will write and execute a pandas script to transform the data and save it as a new file.
              </p>
              
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                disabled={isProcessing || report}
                placeholder="e.g. Drop any rows where 'Age' is null. Convert 'Income' to a numeric value by removing the '$' sign. Drop the 'Cabin' column entirely..."
                className="flex-1 min-h-[200px] w-full bg-surface-raised border border-border rounded-input p-4 text-ink font-mono text-sm resize-none focus:border-signal focus:outline-none transition-colors mb-6"
              />

              {report ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-signal-dim border border-signal/20 rounded-card p-4 text-center">
                    <span className="text-signal font-mono">✓ Cleaning Complete</span>
                    <p className="text-sm text-muted mt-2">A new dataset has been saved to your workspace.</p>
                  </div>
                  <Button variant="primary" size="lg" onClick={() => navigate('/datasets')} className="w-full">
                    View New Dataset
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="primary" 
                  size="lg" 
                  onClick={handleStartCleaning}
                  disabled={isProcessing || !instructions.trim()}
                  className="w-full"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                      Executing Cleaning Pipeline...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Play size={18} /> Start Cleaning
                    </span>
                  )}
                </Button>
              )}
            </div>

            {report && report.preview && report.preview.length > 0 && (
              <div className="bg-surface border border-border rounded-card p-6 animate-fade-in flex flex-col min-h-0">
                <h2 className="font-mono text-lg text-ink mb-4">Cleaned Data Preview</h2>
                <div className="overflow-auto bg-surface-raised border border-border rounded-card p-4">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted font-mono uppercase bg-surface">
                      <tr>
                        {Object.keys(report.preview[0]).map((key) => (
                          <th key={key} className="px-4 py-2 border-b border-border">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.preview.map((row, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-surface transition-colors">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-4 py-2 text-ink whitespace-nowrap">
                              {val !== null ? String(val) : <span className="text-muted italic">null</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted mt-3 text-center">Showing top {report.preview.length} rows of the newly cleaned dataset.</p>
              </div>
            )}
            
          </div>

          {/* Right Panel: Execution Terminal */}
          <div className="bg-[#0f111a] border border-border rounded-card flex flex-col min-h-0 relative overflow-hidden font-mono text-sm shadow-xl">
            {/* Terminal Header */}
            <div className="h-10 bg-[#1a1d27] border-b border-border flex items-center px-4 gap-2 shrink-0">
              <div className="w-3 h-3 rounded-full bg-error/80"></div>
              <div className="w-3 h-3 rounded-full bg-warning/80"></div>
              <div className="w-3 h-3 rounded-full bg-success/80"></div>
              <span className="ml-2 text-xs text-muted/70 select-none">agent-04-data-engineer.exe</span>
            </div>
            
            {/* Terminal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-muted/50 italic text-center mt-10">
                  Waiting for instructions...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="flex gap-3 animate-fade-in">
                    <div className="shrink-0 w-5 flex items-center justify-center mt-0.5">
                      {log.type === 'thought' && <span className="text-signal opacity-70">❯</span>}
                      {log.type === 'info' && <span className="text-muted opacity-70">ℹ</span>}
                      {log.type === 'error' && <span className="text-error">✖</span>}
                    </div>
                    <div className={`flex-1 whitespace-pre-wrap break-words leading-relaxed ${
                      log.type === 'thought' ? 'text-ink/90' :
                      log.type === 'error' ? 'text-error' : 'text-muted'
                    }`}>
                      {log.content}
                    </div>
                  </div>
                ))
              )}
              {isProcessing && (
                <div className="flex gap-3 items-center text-muted animate-pulse">
                  <div className="shrink-0 w-5 flex justify-center">
                    <div className="w-1.5 h-3 bg-signal"></div>
                  </div>
                  <span>Agent is working...</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
          
        </div>
      </div>
    </AppLayout>
  );
}
