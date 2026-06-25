const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (credentials) => apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  register: (data) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  googleAuth: (credential) => apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  }),
  verifyEmail: (token) => apiRequest('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),

  // Sessions
  getSessions: () => apiRequest('/sessions'),
  getSession: (id) => apiRequest(`/sessions/${id}`),
  createSession: (data) => apiRequest('/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteSession: (id) => apiRequest(`/sessions/${id}`, { method: 'DELETE' }),

  // Datasets
  getDatasets: () => apiRequest('/datasets'),
  getDataset: (id) => apiRequest(`/datasets/${id}`),
  uploadDataset: (formData) => apiRequest('/datasets/upload', {
    method: 'POST',
    headers: {},
    body: formData,
  }),
  deleteDataset: (id) => apiRequest(`/datasets/${id}`, { method: 'DELETE' }),

  // Agents
  queryAgent: (sessionId, query) => apiRequest(`/agents/${sessionId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
};
