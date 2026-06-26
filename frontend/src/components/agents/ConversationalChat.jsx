import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Skeleton from '../ui/Skeleton';
import { api } from '../../lib/api';

export default function ConversationalChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState(null);
  const [schema, setSchema] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getDatasets();
        setDatasets(data);
        if (data.length > 0) {
          setSelectedDatasetId(data[0].id);
          setMessages([
            {
              role: 'agent',
              content: `I've connected to your datasets. You can ask questions about ${data.map(d => d.name).join(', ')}. What would you like to know?`,
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
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

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
          dataset_id: selectedDatasetId
        })
      });

      setIsTyping(false);

      if (!response.ok) {
        throw new Error('Failed to fetch from AI');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.error) {
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].content = `Error: ${data.error}`;
                    return newMessages;
                  });
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
              } catch (e) {
                console.error("Error parsing SSE JSON", e, line);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsTyping(false);
      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages[newMessages.length - 1].content === '') {
           newMessages[newMessages.length - 1].content = "Sorry, I encountered an error communicating with the server.";
        }
        return newMessages;
      });
    }
  };

  return (
    <div className="flex h-screen bg-void">
      {/* Left Panel - Data Context */}
      <div className="w-72 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
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
          <Button variant="ghost" size="sm" className="w-full mt-3">
            + Add data
          </Button>
        </div>

        <div className="p-4 flex-1">
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
              className={`mb-4 ${
                message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              }`}
            >
              <div
                className={`max-w-2xl ${
                  message.role === 'user'
                    ? 'bg-surface-raised rounded-card p-4'
                    : 'text-ink whitespace-pre-wrap'
                }`}
              >
                {message.content}
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSend()}
              placeholder="Ask a question about your data..."
              disabled={isTyping}
              className="flex-1 bg-surface border border-border rounded-input h-12 px-4 text-ink focus:border-signal focus:outline-none transition-colors disabled:opacity-50"
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
