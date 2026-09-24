import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Play, 
  Database, 
  FileText, 
  CheckCircle2, 
  RotateCcw, 
  Table as TableIcon, 
  Search, 
  Copy, 
  Check, 
  Maximize2, 
  Minimize2, 
  Sparkles,
  Terminal as TerminalIcon,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';

const markdownComponents = {
  table: ({ node, ...props }) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-border bg-[#121520]">
      <table className="w-full text-xs text-left border-collapse" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-[#191d2b] text-muted font-mono uppercase text-[11px] border-b border-border" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="px-3.5 py-2 font-semibold text-ink whitespace-nowrap" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="px-3.5 py-2 border-t border-border/40 text-ink/90 whitespace-normal" {...props} />
  ),
  ul: ({ node, ...props }) => (
    <ul className="list-disc list-inside space-y-1 my-2 text-ink/90 text-xs sm:text-sm font-sans" {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol className="list-decimal list-inside space-y-1 my-2 text-ink/90 text-xs sm:text-sm font-sans" {...props} />
  ),
  li: ({ node, ...props }) => (
    <li className="text-ink/90 leading-relaxed" {...props} />
  ),
  strong: ({ node, ...props }) => (
    <strong className="text-signal font-semibold" {...props} />
  ),
  hr: ({ node, ...props }) => (
    <hr className="my-3 border-border/60" {...props} />
  ),
  h1: ({ node, ...props }) => (
    <h1 className="text-sm sm:text-base font-mono font-bold text-ink mt-3 mb-2 flex items-center gap-2 border-b border-border/50 pb-1" {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 className="text-xs sm:text-sm font-mono font-bold text-signal mt-3 mb-1.5" {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 className="text-xs font-mono font-bold text-ink mt-2 mb-1" {...props} />
  ),
  p: ({ node, ...props }) => (
    <p className="my-1.5 leading-relaxed text-xs sm:text-sm" {...props} />
  ),
  code: ({ node, inline, className, children, ...props }) => {
    if (inline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-[#181b26] border border-border/60 text-signal font-mono text-xs" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-[#090b11] p-3 rounded-lg border border-border/70 font-mono text-xs overflow-x-auto text-ink/95 my-2 custom-scrollbar" {...props}>
        {children}
      </code>
    );
  }
};

export default function DataCleaner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);
  
  const [dataset, setDataset] = useState(null);
  const [datasets, setDatasets] = useState([]);
  const [instructions, setInstructions] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [report, setReport] = useState(null);
  const [newDatasetId, setNewDatasetId] = useState(null);
  const [activeTab, setActiveTab] = useState('terminal'); // 'summary' | 'terminal'
  const [filterText, setFilterText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef(null);
  const terminalContainerRef = useRef(null);

  useEffect(() => {
    const fetchDatasets = async () => {
      try {
        const allDatasets = await api.getDatasets();
        setDatasets(allDatasets);
        if (id && id !== 'new') {
          const data = await api.getDataset(id);
          setDataset(data);
        } else if (allDatasets.length > 0) {
          setDataset(allDatasets[0]);
        }
      } catch (error) {
        addToast('Failed to load dataset details', 'error');
      }
    };
    fetchDatasets();
  }, [id, addToast]);

  useEffect(() => {
    if (activeTab === 'terminal' && isProcessing && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeTab, isProcessing]);

  const scrollToTop = () => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleStartCleaning = async () => {
    const targetDatasetId = dataset?.id || id;
    if (!targetDatasetId) {
      addToast('Please select or upload a dataset first', 'error');
      return;
    }

    const cleaningPrompt = instructions.trim();
    setIsProcessing(true);
    setActiveTab('terminal');
    setLogs([{ type: 'info', content: cleaningPrompt ? 'Initializing custom cleaning pipeline...' : 'Understanding dataset and preparing automated cleaning...' }]);
    setReport(null);

    try {
      const { session_id } = await api.cleanerStartSession({
        dataset_id: targetDatasetId,
        instructions: cleaningPrompt,
      });

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const token = localStorage.getItem('token');

      const response = await fetch(`${API_BASE}/agents/04/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ session_id }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Execution request failed');
      }

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
              if (data.status === 'thought') {
                setLogs(prev => [...prev, { type: 'thought', content: data.content }]);
              } else if (data.status === 'error') {
                setLogs(prev => [...prev, { type: 'error', content: data.message }]);
                setIsProcessing(false);
                addToast(data.message || 'Cleaning failed', 'error');
              } else if (data.status === 'completed') {
                setReport(data.report);
                setNewDatasetId(data.report.new_dataset_id);
                setIsProcessing(false);
                setActiveTab('summary');
                addToast('Dataset cleaned successfully!', 'success');
              }
            } catch (e) {
              console.error("Failed to parse SSE event:", e);
            }
          }
        }
      }
    } catch (error) {
      addToast(error.message || 'Failed to start cleaning session', 'error');
      setIsProcessing(false);
    }
  };

  const handleCopyJson = () => {
    if (!report?.preview) return;
    navigator.clipboard.writeText(JSON.stringify(report.preview, null, 2));
    setCopied(true);
    addToast('Preview data copied to clipboard', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const parseShapes = (text) => {
    if (!text) return null;
    const initialMatch = text.match(/initial\s+shape:?\*?\*?\s*\(?([0-9]+)\s*,\s*([0-9]+)\)?/i);
    const finalMatch = text.match(/final\s+shape:?\*?\*?\s*\(?([0-9]+)\s*,\s*([0-9]+)\)?/i);
    if (initialMatch || finalMatch) {
      return {
        initialRows: initialMatch ? initialMatch[1] : null,
        initialCols: initialMatch ? initialMatch[2] : null,
        finalRows: finalMatch ? finalMatch[1] : null,
        finalCols: finalMatch ? finalMatch[2] : null,
      };
    }
    return null;
  };
  const shapes = parseShapes(report?.summary);

  const columns = report?.preview && report.preview.length > 0 ? Object.keys(report.preview[0]) : [];

  const filteredPreview = (report?.preview || []).filter((row) => {
    if (!filterText.trim()) return true;
    const q = filterText.toLowerCase();
    return Object.values(row).some((val) =>
      val !== null && val !== undefined && String(val).toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col p-6 max-w-7xl mx-auto gap-6 pb-16">
        
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
          {datasets.length > 1 && (!id || id === 'new') ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-mono">Target Dataset:</span>
              <select
                value={dataset?.id || ''}
                onChange={(e) => {
                  const found = datasets.find(d => d.id === e.target.value);
                  if (found) setDataset(found);
                }}
                className="bg-surface border border-border text-ink text-xs font-mono px-3 py-1.5 rounded-full focus:outline-none focus:border-signal outline-none"
              >
                {datasets.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          ) : dataset ? (
            <div className="text-sm text-muted font-mono bg-surface border border-border px-3 py-1 rounded-full">
              Target: {dataset.name}
            </div>
          ) : null}
        </div>

        {/* Top Section: Config & Terminal/Report */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${report ? 'min-h-[420px] lg:h-[450px]' : 'flex-1 min-h-[520px]'}`}>
          
          {/* Left Panel: Configuration / Summary */}
          {report ? (
            <div className="bg-surface border border-border rounded-card p-6 flex flex-col justify-between h-full shadow-lg animate-fade-in">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-signal/15 border border-signal/30 flex items-center justify-center text-signal">
                      <CheckCircle2 size={18} />
                    </div>
                    <div>
                      <h2 className="font-mono text-base text-ink font-semibold">Cleaning Completed</h2>
                      <p className="text-xs text-muted">Transformed & saved to workspace</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-signal-dim text-signal border border-signal/20 font-medium">
                    Ready
                  </span>
                </div>

                <div className="space-y-3 my-4">
                  {/* Before & After Shape Metrics */}
                  {shapes && (
                    <div className="grid grid-cols-2 gap-2 bg-[#0d0f17] p-3 rounded-lg border border-border/80">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block font-mono">Before Cleaning</span>
                        <span className="text-xs font-mono font-semibold text-ink">
                          {shapes.initialRows} rows × {shapes.initialCols} cols
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block font-mono">After Cleaning</span>
                        <span className="text-xs font-mono font-semibold text-signal flex items-center gap-1">
                          {shapes.finalRows} rows × {shapes.finalCols} cols
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bg-surface-raised border border-border rounded-lg p-3 text-xs font-mono space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted">Target Dataset:</span>
                      <span className="text-ink font-medium">{dataset?.name || 'Dataset'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Cleaning Mode:</span>
                      <span className="text-signal">{instructions.trim() ? 'Custom AI Rules' : 'Automated Auto-Clean'}</span>
                    </div>
                    {newDatasetId && (
                      <div className="flex justify-between">
                        <span className="text-muted">Status:</span>
                        <span className="text-success font-medium">Saved to Database</span>
                      </div>
                    )}
                  </div>

                  {instructions.trim() && (
                    <div className="bg-surface-raised/60 border border-border/70 rounded-lg p-3">
                      <span className="text-[11px] font-mono text-muted uppercase tracking-wider block mb-1">Custom Instructions Applied:</span>
                      <p className="text-xs font-mono text-ink italic bg-surface/50 p-2 rounded border border-border/40 line-clamp-3">
                        "{instructions}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button 
                  variant="primary" 
                  size="lg" 
                  onClick={() => navigate('/datasets')} 
                  className="w-full shadow-md shadow-signal/10 flex items-center justify-center gap-2"
                >
                  <Database size={18} /> View in Datasets
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setReport(null)} 
                  className="w-full text-muted hover:text-ink flex items-center justify-center gap-1.5 text-xs font-mono"
                >
                  <RotateCcw size={13} /> Clean Another or Adjust Rules
                </Button>
              </div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-card p-6 flex flex-col h-full shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-lg text-ink flex items-center gap-2">
                  <FileText size={20} className="text-signal" /> Cleaning Instructions
                </h2>
                <span className="text-xs text-muted font-mono bg-surface-raised border border-border px-2.5 py-1 rounded-full">
                  Agent 04
                </span>
              </div>
              <p className="text-muted text-sm mb-4">
                Describe specific transformations, or leave blank to let the AI automatically inspect, understand, and clean the dataset (fixing missing values, removing duplicates, and handling outliers).
              </p>
              
              <div className="flex-1 flex flex-col min-h-0 mb-4">
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Optional: Specify custom cleaning rules (e.g. 'Drop rows where Age < 0', 'Impute missing values using group median', 'Remove outliers from Fare')... Or leave blank to auto-clean."
                  className="flex-1 min-h-[160px] w-full bg-surface-raised border border-border rounded-input p-4 text-ink font-mono text-sm resize-none focus:border-signal focus:outline-none transition-colors"
                />
              </div>

              {/* Quick Presets / Suggestions when empty */}
              {!instructions && !isProcessing && (
                <div className="mb-4">
                  <div className="text-[11px] font-mono text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Sparkles size={12} className="text-signal" /> Example prompts:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      "Handle all missing values and remove duplicates",
                      "Cap numeric outliers at 99th percentile",
                      "Normalize column names to snake_case"
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setInstructions(prompt)}
                        className="text-[11px] font-mono bg-surface-raised hover:bg-surface border border-border/80 hover:border-signal/40 text-muted hover:text-ink px-2.5 py-1 rounded-md transition-colors text-left"
                      >
                        + {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button 
                variant="primary" 
                size="lg" 
                onClick={handleStartCleaning}
                disabled={isProcessing}
                className="w-full shadow-lg shadow-signal/15"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    Cleaning & Transforming Dataset...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Play size={18} /> {instructions.trim() ? "Clean Dataset" : "Auto-Clean Dataset"}
                  </span>
                )}
              </Button>
            </div>
          )}

          {/* Right Panel: Tabbed Summary / Terminal */}
          <div className="bg-[#0f111a] border border-border rounded-card flex flex-col min-h-[340px] lg:min-h-0 relative overflow-hidden font-mono text-sm shadow-xl">
            {/* Terminal Header with Tabs */}
            <div className="h-11 bg-[#161823] border-b border-border flex items-center justify-between px-4 shrink-0 select-none">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-error/80"></div>
                  <div className="w-3 h-3 rounded-full bg-warning/80"></div>
                  <div className="w-3 h-3 rounded-full bg-success/80"></div>
                </div>

                <div className="flex items-center gap-1 bg-[#0d0f17] p-0.5 rounded-lg border border-border/60">
                  <button
                    type="button"
                    onClick={() => setActiveTab('summary')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === 'summary'
                        ? 'bg-signal/15 text-signal font-semibold border border-signal/30'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <FileText size={13} />
                    <span>Cleaning Report</span>
                    {report && (
                      <span className="w-1.5 h-1.5 rounded-full bg-signal animate-pulse"></span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('terminal')}
                    className={`px-3 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
                      activeTab === 'terminal'
                        ? 'bg-signal/15 text-signal font-semibold border border-signal/30'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <TerminalIcon size={13} />
                    <span>Terminal Logs</span>
                    {isProcessing && (
                      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-ping"></span>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Actions for Terminal */}
              {activeTab === 'terminal' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={scrollToTop}
                    title="Scroll to beginning of logs"
                    className="p-1 rounded text-muted hover:text-ink hover:bg-surface-raised transition-colors text-xs flex items-center gap-0.5 font-mono"
                  >
                    <ChevronUp size={13} /> Top
                  </button>
                  <button
                    type="button"
                    onClick={scrollToBottom}
                    title="Scroll to latest log"
                    className="p-1 rounded text-muted hover:text-ink hover:bg-surface-raised transition-colors text-xs flex items-center gap-0.5 font-mono"
                  >
                    <ChevronDown size={13} /> End
                  </button>
                </div>
              )}
            </div>
            
            {/* Panel Body: Summary Tab vs Terminal Tab */}
            {activeTab === 'summary' ? (
              <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-[#0d0f17]">
                {report?.summary ? (
                  <div className="prose prose-invert prose-sm max-w-none text-ink/90 leading-relaxed font-sans">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {report.summary}
                    </ReactMarkdown>
                  </div>
                ) : isProcessing ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
                    <div className="w-8 h-8 border-2 border-signal border-t-transparent rounded-full animate-spin mb-3"></div>
                    <p className="font-mono text-xs text-signal">Generating comprehensive cleaning report...</p>
                    <p className="text-xs text-muted/60 mt-1 max-w-xs font-sans">
                      The AI data engineer is currently inspecting distributions and applying transformations.
                    </p>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted/60 font-mono text-xs">
                    <FileText size={28} className="text-muted/40 mb-2" />
                    <span>Run auto-clean to see the full diagnosis, transformations, and summary report.</span>
                  </div>
                )}
              </div>
            ) : (
              <div ref={terminalContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0a0c12]">
                {logs.length === 0 ? (
                  <div className="text-muted/50 italic text-center mt-10 font-mono text-xs">
                    Waiting for instructions...
                  </div>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="flex gap-3 animate-fade-in text-xs sm:text-sm">
                      <div className="shrink-0 w-5 flex items-center justify-center mt-1">
                        {log.type === 'thought' && <span className="text-signal opacity-80">❯</span>}
                        {log.type === 'info' && <span className="text-muted opacity-80">ℹ</span>}
                        {log.type === 'error' && <span className="text-error">✖</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        {log.type === 'thought' ? (
                          <div className="prose prose-invert prose-sm max-w-none font-sans leading-relaxed text-ink/90">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={markdownComponents}
                            >
                              {log.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className={`whitespace-pre-wrap break-words font-mono ${
                            log.type === 'error' ? 'text-error' : 'text-muted'
                          }`}>
                            {log.content}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isProcessing && (
                  <div className="flex gap-3 items-center text-muted animate-pulse font-mono text-xs pt-2">
                    <div className="shrink-0 w-5 flex justify-center">
                      <div className="w-1.5 h-3 bg-signal"></div>
                    </div>
                    <span>Agent is working...</span>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            )}
          </div>
          
        </div>

        {/* Full-Width Bottom Section: Cleaned Data Preview */}
        {report && report.preview && report.preview.length > 0 && (
          <div className="w-full bg-surface border border-border rounded-card p-6 shadow-xl animate-fade-in flex flex-col gap-4">
            {/* Preview Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-signal/10 border border-signal/20 text-signal">
                  <TableIcon size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-mono text-lg text-ink font-semibold">Cleaned Data Preview</h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-signal-dim text-signal border border-signal/30 font-medium">
                      {report.preview.length} Rows Sample
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-surface-raised text-muted border border-border">
                      {columns.length} Columns
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    First {report.preview.length} rows of the newly cleaned, transformed, and validated dataset.
                  </p>
                </div>
              </div>

              {/* Actions & Filter */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Filter preview rows..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="bg-surface-raised border border-border text-ink text-xs font-mono pl-8 pr-7 py-1.5 rounded-input focus:outline-none focus:border-signal w-40 sm:w-56"
                  />
                  {filterText && (
                    <button 
                      onClick={() => setFilterText('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs font-mono"
                    >
                      ×
                    </button>
                  )}
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyJson}
                  title="Copy preview JSON to clipboard"
                  className="text-xs"
                >
                  {copied ? <Check size={14} className="mr-1.5 text-signal" /> : <Copy size={14} className="mr-1.5" />}
                  {copied ? 'Copied!' : 'Copy JSON'}
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  title={isExpanded ? "Collapse preview height" : "Expand preview height"}
                  className="text-xs"
                >
                  {isExpanded ? <Minimize2 size={14} className="mr-1.5" /> : <Maximize2 size={14} className="mr-1.5" />}
                  {isExpanded ? 'Default View' : 'Expand View'}
                </Button>
              </div>
            </div>

            {/* Table Container */}
            <div className={`w-full overflow-auto rounded-lg border border-border bg-[#0d0f17] custom-scrollbar transition-all duration-200 ${isExpanded ? 'max-h-[750px]' : 'max-h-[460px]'}`}>
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs text-muted font-mono uppercase bg-[#151824] sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-3 py-3 border-b border-border text-center w-12 text-muted/60 bg-[#151824] sticky left-0 z-20">
                      #
                    </th>
                    {columns.map((key) => (
                      <th 
                        key={key} 
                        className="px-4 py-3 border-b border-border font-mono tracking-wider whitespace-nowrap text-muted hover:text-ink"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono text-xs">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-muted italic">
                        No rows matched filter "{filterText}"
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map((row, i) => (
                      <tr 
                        key={i} 
                        className="hover:bg-surface-raised/80 transition-colors group"
                      >
                        <td className="px-3 py-2.5 text-center text-muted/50 border-r border-border/30 bg-[#0d0f17] group-hover:bg-[#131620] sticky left-0 z-10">
                          {i + 1}
                        </td>
                        {columns.map((colKey, j) => {
                          const val = row[colKey];
                          return (
                            <td key={j} className="px-4 py-2.5 text-ink whitespace-nowrap">
                              {val === null || val === undefined ? (
                                <span className="text-muted/40 italic px-1.5 py-0.5 rounded bg-surface/50 border border-border/30 text-[11px]">
                                  null
                                </span>
                              ) : typeof val === 'boolean' ? (
                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  val ? 'bg-signal/15 text-signal border border-signal/30' : 'bg-muted/15 text-muted border border-border'
                                }`}>
                                  {String(val)}
                                </span>
                              ) : typeof val === 'number' ? (
                                <span className="text-signal/90 font-mono">
                                  {Number.isInteger(val) ? val : Number(val.toFixed(4))}
                                </span>
                              ) : (
                                <span>{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Stats & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted font-mono pt-1">
              <span>
                {filterText 
                  ? `Showing ${filteredPreview.length} of ${report.preview.length} rows matching "${filterText}"` 
                  : `Showing all ${report.preview.length} sample rows across all ${columns.length} dataset columns.`}
              </span>
              <button 
                onClick={() => navigate('/datasets')} 
                className="text-signal hover:underline flex items-center gap-1 font-medium transition-colors"
              >
                Open full dataset in workspace <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
