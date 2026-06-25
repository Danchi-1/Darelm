import { useState } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';

const datasets = [
  { id: 1, name: 'sales_q1_2024.csv', type: 'CSV', size: '2.4 MB', date: '2024-01-15' },
  { id: 2, name: 'customers.db', type: 'PostgreSQL', size: '156 MB', date: '2024-01-10' },
  { id: 3, name: 'transactions.xlsx', type: 'Excel', size: '8.7 MB', date: '2024-01-08' },
  { id: 4, name: 'products.csv', type: 'CSV', size: '1.2 MB', date: '2024-01-05' },
];

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size', numeric: true },
  { key: 'date', label: 'Date added' },
  { key: 'actions', label: '' },
];

export default function Datasets() {
  const [showDbModal, setShowDbModal] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    // TODO: Handle file upload
  };

  const handleFileSelect = (e) => {
    // TODO: Handle file selection
  };

  const handleTestConnection = () => {
    // TODO: Test database connection
    alert('Connection test would run here');
  };

  const tableData = datasets.map((dataset) => ({
    ...dataset,
    type: <Badge variant="active">{dataset.type}</Badge>,
    actions: (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">
          View
        </Button>
        <Button variant="danger" size="sm">
          Delete
        </Button>
      </div>
    ),
  }));

  return (
    <div className="flex min-h-screen bg-void">
      <Sidebar />
      <main className="flex-1 ml-60 p-12">
        <h1 className="font-mono text-2xl text-ink mb-8">Datasets</h1>

        {/* Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-card p-12 text-center mb-8 transition-colors ${
            isDragging ? 'border-signal bg-signal-dim' : 'border-border hover:border-muted'
          }`}
        >
          <p className="text-muted mb-4">
            Drop CSV or Excel here, or click to browse
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload">
            <Button variant="ghost" size="sm" as="span">
              Browse files
            </Button>
          </label>
        </div>

        {/* Database Connection Button */}
        <div className="mb-8">
          <Button variant="ghost" size="md" onClick={() => setShowDbModal(true)}>
            + Connect database
          </Button>
        </div>

        {/* Datasets Table */}
        <Table columns={columns} data={tableData} />

        {/* Database Connection Modal */}
        <Modal isOpen={showDbModal} onClose={() => setShowDbModal(false)}>
          <h2 className="font-mono text-lg text-ink mb-4">Connect database</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-muted mb-2">Connection string</label>
              <input
                type="text"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                placeholder="postgresql://user:password@host:port/database"
                className="w-full bg-surface border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="md" onClick={() => setShowDbModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleTestConnection}>
                Test connection
              </Button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
