import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Skeleton from '../components/ui/Skeleton';
import { api } from '../lib/api';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Size', numeric: true },
  { key: 'date', label: 'Date added' },
  { key: 'actions', label: '' },
];

export default function Datasets() {
  const [datasets, setDatasets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDbModal, setShowDbModal] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fetchDatasets = async () => {
    try {
      const data = await api.getDatasets();
      setDatasets(data);
    } catch (error) {
      console.error('Failed to fetch datasets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = async (file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    try {
      await api.uploadDataset(formData);
      await fetchDatasets();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload dataset: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleTestConnection = async () => {
    if (!connectionString) {
      alert("Please enter a connection string");
      return;
    }
    
    setIsLoading(true);
    try {
      await api.connectDatabase({
        name: "Remote Database",
        connection_string: connectionString
      });
      setShowDbModal(false);
      setConnectionString('');
      await fetchDatasets();
    } catch (error) {
      console.error('Connection failed:', error);
      alert('Failed to connect: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const tableData = datasets.map((dataset) => ({
    ...dataset,
    type: <Badge variant="active">{dataset.type}</Badge>,
    actions: (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">
          View
        </Button>
        <Button variant="danger" size="sm" onClick={async () => {
          try {
            await api.deleteDataset(dataset.id);
            fetchDatasets();
          } catch(e) {
            console.error(e);
          }
        }}>
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
          className={`border-2 border-dashed rounded-card p-12 text-center mb-8 transition-colors cursor-pointer ${
            isDragging ? 'border-signal bg-signal-dim' : 'border-border hover:border-muted'
          }`}
          onClick={() => document.getElementById('file-upload').click()}
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
          <Button variant="ghost" size="sm">
            Browse files
          </Button>
        </div>

        {/* Database Connection Button */}
        <div className="mb-8">
          <Button variant="ghost" size="md" onClick={() => setShowDbModal(true)}>
            + Connect database
          </Button>
        </div>

        {/* Datasets Table */}
        {isLoading ? (
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-4 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : datasets.length > 0 ? (
          <Table columns={columns} data={tableData} />
        ) : (
          <div className="bg-surface border border-border rounded-card p-8 text-center text-muted">
            No datasets yet. Upload one to get started.
          </div>
        )}

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
