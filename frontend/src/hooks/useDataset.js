import { useState, useEffect } from 'react';

export function useDataset(datasetId) {
  const [dataset, setDataset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: Fetch dataset data from API
    setLoading(false);
  }, [datasetId]);

  return { dataset, loading, error };
}

export function useDatasets() {
  const [datasets, setDatasets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // TODO: Fetch datasets from API
    setLoading(false);
  }, []);

  return { datasets, loading, error };
}
