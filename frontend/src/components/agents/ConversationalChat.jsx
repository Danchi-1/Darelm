import { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronRight, Loader2, CheckCircle, XCircle, Zap } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToastStore } from '../../store/toastStore';
import { api } from '../../lib/api';

export default function ConversationalChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSchema, setShowSchema] = useState(true);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [schema, setSchema] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showThoughts, setShowThoughts] = useState(true);
  const messagesEndRef = useRef(null);
  const addToast = useToastStore((state) => state.addToast);
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoadingData(true);
      setMessages([]);
      try {
        const data = await api.getDatasets();
        setDatasets(data);
        
        if (sessionId && sessionId !== 'new') {
          // Load existing session
          try {
            const sessionData = await api.getSession(sessionId);
            setSelectedDatasetId(sessionData.dataset_id || (data.length > 0 ? data[0].id : null));
            
            // Map backend messages to frontend format
            const formattedMessages = sessionData.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              thought: msg.thought,
              toolCalls: msg.tool_calls
            }));
            
            setMessages(formattedMessages.length > 0 ? formattedMessages : [
              {
                role: 'agent',
                content: `Session resumed. How can I help you today?`,
              }
            ]);
            setIsLoadingData(false);
            return;
          } catch (e) {
            console.error("Failed to load session", e);
            addToast("Failed to load session history", "error");
          }
        }
        
        if (data.length > 0) {
          // Do not auto-select for new sessions so user explicitly chooses
          setSelectedDatasetId(null);
          setMessages([
            {
              role: 'agent',
              content: "Please select a dataset from the left panel to get started.",
            },
          ]);
        } else {
          setMessages([
            {
              role: 'agent',
              content: "No datasets connected yet. Please upload a dataset to get started.",
            },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch datasets:', error);
        setMessages([
          {
            role: 'agent',
            content: "Failed to load datasets. Please try again later.",
          },
        ]);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  }, [sessionId]);

  useEffect(() => {
    const fetchSchema = async () => {
      if (selectedDatasetId) {
        try {
          const schemaData = await api.getDatasetSchema(selectedDatasetId);
          setSchema(schemaData.columns || []);
        } catch (error) {
          console.error('Failed to fetch schema:', error);
        }
      }
    };

    fetchSchema();
  }, [selectedDatasetId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const ToolCallItem = ({ toolCall }) => {
    const statusIcon = {
      running: <Loader2 size={14} className="animate-spin text-signal" />,
      completed: <CheckCircle size={14} className="text-signal" />,
      failed: <XCircle size={14} className="text-danger" />,
    }[toolCall.status] || <Zap size={14} className="text-muted" />;

    return (
      <div className="flex items-start gap-2 p-2 bg-surface-raised rounded border border-border">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-ink truncate">{toolCall.name}</div>
          {toolCall.status === 'running' && (
            <div className="text-xs text-muted mt-1">Executing...</div>
          )}
          {toolCall.status === 'completed' && toolCall.result && (
            <div className="text-xs text-muted mt-1 truncate">{toolCall.result}</div>
          )}
          {toolCall.status === 'failed' && toolCall.result && (
            <div className="text-xs text-danger mt-1 truncate">{toolCall.result}</div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (!selectedDatasetId) {
      addToast('Please select a dataset first', 'error');
      return;
    }

    const userMessage = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Add an empty agent message to stream into
    setMessages((prev) => [...prev, { role: 'agent', content: '' }]);

    try {
      const token = localStorage.getItem('token');
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      
      const response = await fetch(`${API_BASE}/agents/01/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          message: input,
          dataset_id: selectedDatasetId,
          ...(sessionId && sessionId !== 'new' && { session_id: sessionId })
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch from AI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep the last partial line in the buffer
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                
                if (data.session_id && (!sessionId || sessionId === 'new')) {
                  navigate(`/session/${data.session_id}`, { replace: true });
                }
                
                if (data.error) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = `Error: ${data.error}`;
                    return newMessages;
                  });
                  addToast('Error from agent: ' + data.error, 'error');
                  break;
                }
                
                if (data.content) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      content: newMessages[lastIndex].content + data.content
                    };
                    return newMessages;
                  });
                }

                if (data.thought) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      thought: (newMessages[lastIndex].thought || '') + data.thought
                    };
                    return newMessages;
                  });
                }

                if (data.tool_call) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      toolCalls: [...(newMessages[lastIndex].toolCalls || []), data.tool_call]
                    };
                    return newMessages;
                  });
                }

                if (data.tool_result) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    const toolCalls = newMessages[lastIndex].toolCalls || [];
                    const updatedToolCalls = toolCalls.map(tc => 
                      tc.id === data.tool_result.id 
                        ? { ...tc, result: data.tool_result.result, status: data.tool_result.status }
                        : tc
                    );
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      toolCalls: updatedToolCalls
                    };
                    return newMessages;
                  });
                }
              } catch (e) {
                console.error("Error parsing SSE JSON", e, line);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      addToast('Failed to communicate with the server', 'error');
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].content === '') {
           newMessages[newMessages.length - 1].content = "Sorry, I encountered an error communicating with the server.";
        }
        return newMessages;
      });
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-void">
      {/* Left Panel - Data Context */}
      <div className="w-72 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-mono text-sm text-ink mb-3">Select dataset</h3>
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="w-full bg-surface border border-border rounded-card p-3 text-ink text-sm focus:border-signal focus:outline-none transition-colors mb-3"
          >
            <option value="">Select a dataset...</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name}
              </option>
            ))}
          </select>
          
          <h3 className="font-mono text-sm text-ink mb-3">Connected datasets</h3>
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <div 
                key={dataset.id} 
                onClick={() => setSelectedDatasetId(dataset.id)}
                className={`rounded-card p-3 cursor-pointer transition-colors ${
                  selectedDatasetId === dataset.id 
                    ? 'bg-signal-dim border border-signal' 
                    : 'bg-surface-raised border border-transparent hover:border-border'
                }`}
              >
                <span className={`font-mono text-xs block ${selectedDatasetId === dataset.id ? 'text-signal' : 'text-ink'}`}>
                  {dataset.name}
                </span>
                <span className="text-xs text-muted">
                  {dataset.size_bytes ? `${Math.round(dataset.size_bytes/1024)} KB` : dataset.dataset_type}
                </span>
              </div>
            ))}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full mt-3"
            onClick={() => navigate('/datasets')}
          >
            + Add data
          </Button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="font-mono text-sm text-ink mb-3 flex items-center gap-2"
          >
            <span className="text-signal">{showSchema ? '▼' : '▶'}</span>
            Schema preview
          </button>
          {showSchema && (
            <div className="space-y-1">
              {schema.map((column) => (
                <div key={column.name} className="flex justify-between text-xs">
                  <span className="font-mono text-ink">{column.name}</span>
                  <Badge variant="neutral">{column.type}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-6 ${
                message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }`}
            >
              <div className={`max-w-2xl ${message.role === 'user' ? 'w-full' : 'w-full'}`}>
                {message.role === 'agent' && (
                  <>
                    {/* Agent Thoughts Section */}
                    {(message.thought || message.toolCalls) && (
                      <div className="mb-3">
                        <button
                          onClick={() => setShowThoughts(!showThoughts)}
                          className="flex items-center gap-2 text-xs text-muted font-mono mb-2 hover:text-ink transition-colors"
                        >
                          {showThoughts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          <span>Agent reasoning</span>
                          {message.toolCalls && message.toolCalls.length > 0 && (
                            <Badge variant="neutral" className="text-[10px]">
                              {message.toolCalls.length} tool{message.toolCalls.length > 1 ? 's' : ''}
                            </Badge>
                          )}
                        </button>
                        
                        {showThoughts && (
                          <div className="space-y-2">
                            {/* Thoughts */}
                            {message.thought && (
                              <div className="bg-surface-dim border border-border rounded-card p-3">
                                <div className="text-xs text-muted font-mono mb-1">Thinking</div>
                                <div className="text-sm text-ink whitespace-pre-wrap">{message.thought}</div>
                              </div>
                            )}
                            
                            {/* Tool Calls */}
                            {message.toolCalls && message.toolCalls.length > 0 && (
                              <div className="space-y-1">
                                {message.toolCalls.map((toolCall, tcIndex) => (
                                  <ToolCallItem key={tcIndex} toolCall={toolCall} />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Final Response */}
                    <div className="text-ink text-sm w-full overflow-hidden markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </>
                )}
                
                {message.role === 'user' && (
                  <div className="bg-surface-raised rounded-card p-4">
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-1 text-muted font-mono">
              <span className="typing-dot">.</span>
              <span className="typing-dot">.</span>
              <span className="typing-dot">.</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isTyping) handleSend();
                }
              }}
              placeholder="Ask a question about your data... (Shift+Enter for new line)"
              disabled={isTyping}
              rows={1}
              className="flex-1 bg-surface border border-border rounded-input min-h-[48px] max-h-32 py-3 px-4 text-ink focus:border-signal focus:outline-none transition-colors disabled:opacity-50 resize-none custom-scrollbar"
            />
            <button
              onClick={handleSend}
              disabled={isTyping}
              className="w-12 h-12 bg-surface border border-border rounded-btn flex items-center justify-center text-signal hover:border-signal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
