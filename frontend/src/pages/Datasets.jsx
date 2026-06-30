import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Table from '../components/ui/Table';
import Skeleton from '../components/ui/Skeleton';
import { useToastStore } from '../store/toastStore';
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
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [datasetSchema, setDatasetSchema] = useState([]);
  const [connectionString, setConnectionString] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

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
    
    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const validExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      addToast('Invalid file type. Please upload CSV or Excel files.', 'error');
      return;
    }
    
    // Validate file size (max 2GB)
    const maxSize = 2000 * 1024 * 1024;
    if (file.size > maxSize) {
      addToast('File too large. Maximum size is 2GB.', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    try {
      await api.uploadDataset(formData);
      await fetchDatasets();
      addToast('Dataset uploaded successfully', 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      addToast('Failed to upload dataset: ' + error.message, 'error');
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
    if (!connectionString.trim()) {
      addToast('Please enter a connection string', 'error');
      return;
    }

    // Basic connection string validation
    const validPrefixes = ['postgresql://', 'mysql://', 'mongodb://', 'sqlite://'];
    const hasValidPrefix = validPrefixes.some(prefix => connectionString.toLowerCase().startsWith(prefix));
    
    if (!hasValidPrefix) {
      addToast('Invalid connection string format. Must start with postgresql://, mysql://, mongodb://, or sqlite://', 'error');
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
      addToast('Database connected successfully', 'success');
    } catch (error) {
      console.error('Connection failed:', error);
      addToast('Failed to connect: ' + error.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl) {
      addToast('Please enter a URL', 'error');
      return;
    }
    
    setIsImporting(true);
    try {
      await api.importDatasetFromUrl(importUrl);
      setShowUrlModal(false);
      setImportUrl('');
      await fetchDatasets();
      addToast('Dataset imported successfully', 'success');
    } catch (error) {
      console.error('Import failed:', error);
      addToast('Failed to import: ' + (error.detail || error.message), 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewDataset = async (dataset) => {
    setSelectedDataset(dataset);
    setShowViewModal(true);
    try {
      const schemaData = await api.getDatasetSchema(dataset.id);
      setDatasetSchema(schemaData.columns || []);
    } catch (error) {
      console.error('Failed to fetch schema:', error);
      setDatasetSchema([]);
    }
  };

  const handleDeleteDataset = async (datasetId, e) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this dataset?')) return;
    
    try {
      await api.deleteDataset(datasetId);
      await fetchDatasets();
      addToast('Dataset deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete dataset:', error);
      addToast('Failed to delete dataset: ' + error.message, 'error');
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0 || bytes === null || bytes === undefined) return '-';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const tableData = datasets.map((dataset) => ({
    ...dataset,
    name: dataset.name,
    type: <Badge variant="active">{dataset.dataset_type || dataset.type}</Badge>,
    size: formatBytes(dataset.size_bytes),
    date: dataset.created_at ? new Date(dataset.created_at).toLocaleDateString() : dataset.date,
    actions: (
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={() => handleViewDataset(dataset)}>
          View
        </Button>
        <Button variant="danger" size="sm" onClick={(e) => handleDeleteDataset(dataset.id, e)}>
          Delete
        </Button>
      </div>
    ),
  }));

  return (
    <AppLayout>
      <div className="p-12 max-w-6xl mx-auto">
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

        {/* Database Connection & URL Import Buttons */}
        <div className="mb-8 flex gap-4">
          <Button variant="ghost" size="md" onClick={() => setShowDbModal(true)}>
            + Connect database
          </Button>
          <Button variant="ghost" size="md" onClick={() => setShowUrlModal(true)}>
            + Import from URL (Kaggle/Public)
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

        {/* URL Import Modal */}
        <Modal isOpen={showUrlModal} onClose={() => setShowUrlModal(false)}>
          <h2 className="font-mono text-lg text-ink mb-4">Import from URL</h2>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Paste a public URL to a CSV or Excel file (like a GitHub Raw link), or paste a Kaggle Dataset URL. 
              Kaggle datasets require configuring your credentials in <Link to="/settings" className="text-signal hover:underline">Settings</Link> first.
            </p>
            <input
              type="text"
              placeholder="https://..."
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="w-full bg-surface-raised border border-border rounded-input h-11 px-4 text-ink focus:border-signal focus:outline-none transition-colors"
            />
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="md" onClick={() => setShowUrlModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleImportUrl} disabled={!importUrl || isImporting}>
                {isImporting ? 'Importing...' : 'Import Dataset'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Dataset View Modal */}
        <Modal isOpen={showViewModal} onClose={() => setShowViewModal(false)}>
          <h2 className="font-mono text-lg text-ink mb-4">{selectedDataset?.name}</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-mono text-sm text-ink mb-3">Schema</h3>
              {datasetSchema.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {datasetSchema.map((column) => (
                    <div key={column.name} className="flex justify-between items-center p-3 bg-surface-raised rounded-card">
                      <span className="font-mono text-sm text-ink">{column.name}</span>
                      <Badge variant="neutral">{column.type}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No schema available</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" size="md" onClick={() => setShowViewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
