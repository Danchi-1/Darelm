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
  Sparkles 
} from 'lucide-react';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import { useToastStore } from '../store/toastStore';
import { api } from '../lib/api';

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
  const [filterText, setFilterText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef(null);

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
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleStartCleaning = async () => {
    const targetDatasetId = dataset?.id || id;
    if (!targetDatasetId) {
      addToast('Please select or upload a dataset first', 'error');
      return;
    }

    const cleaningPrompt = instructions.trim();
    setIsProcessing(true);
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

        {/* Top Section: Config & Terminal */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${report ? 'min-h-[360px] lg:h-[390px]' : 'flex-1 min-h-[520px]'}`}>
          
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

          {/* Right Panel: Execution Terminal */}
          <div className="bg-[#0f111a] border border-border rounded-card flex flex-col min-h-[320px] lg:min-h-0 relative overflow-hidden font-mono text-sm shadow-xl">
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
