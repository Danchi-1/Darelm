import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

const datasets = [
  { name: 'sales_q1_2024.csv', size: '2.4 MB' },
  { name: 'customers.db', size: '156 MB' },
];

const schema = [
  { name: 'id', type: 'INTEGER' },
  { name: 'date', type: 'DATE' },
  { name: 'revenue', type: 'FLOAT' },
  { name: 'region', type: 'VARCHAR' },
];

const initialMessages = [
  {
    role: 'agent',
    content: "I've connected to your datasets. You can ask questions about sales_q1_2024.csv and customers.db. What would you like to know?",
  },
];

export default function ConversationalChat() {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSchema, setShowSchema] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate agent response
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'agent',
          content: `Based on your data, here's what I found:\n\nTotal revenue for Q1 2024: $1,234,567\n\nThe top performing region was North America with 45% of total revenue.`,
        },
      ]);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-void">
      {/* Left Panel - Data Context */}
      <div className="w-72 bg-surface border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-mono text-sm text-ink mb-3">Connected datasets</h3>
          <div className="space-y-2">
            {datasets.map((dataset) => (
              <div key={dataset.name} className="bg-surface-raised rounded-card p-3">
                <span className="font-mono text-xs text-ink block">{dataset.name}</span>
                <span className="text-xs text-muted">{dataset.size}</span>
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
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about your data..."
              className="flex-1 bg-surface border border-border rounded-input h-12 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
            />
            <button
              onClick={handleSend}
              className="w-12 h-12 bg-surface border border-border rounded-btn flex items-center justify-center text-signal hover:border-signal transition-colors"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
