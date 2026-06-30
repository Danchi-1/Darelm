const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!response.ok) {
    let errorMessage = `API error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMessage = errorData.detail;
      }
    } catch (e) {
      // If parsing fails, use statusText
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  // Auth
  login: (credentials) => {
    // FastAPI OAuth2PasswordRequestForm expects form data, not JSON
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    return apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
  },
  register: (data) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  googleAuth: (credential) => apiRequest('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  }),
  verifyEmail: (token) => apiRequest(`/auth/verify-email?token=${token}`, {
    method: 'GET',
  }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  getCurrentUser: () => apiRequest('/users/me', { method: 'GET' }),

  // Sessions
  getSessions: () => apiRequest('/agents/01/sessions'),
  getSession: (id) => apiRequest(`/agents/01/sessions/${id}`),
  createSession: (data) => apiRequest('/agents/01/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateSession: (agentId, id, data) => apiRequest(`/agents/${agentId}/sessions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteSession: (agentId, id) => apiRequest(`/agents/${agentId}/sessions/${id}`, { method: 'DELETE' }),

  // Datasets
  getDatasets: () => apiRequest('/datasets'),
  getDataset: (id) => apiRequest(`/datasets/${id}`),
  getDatasetSchema: (id) => apiRequest(`/datasets/${id}/schema`),
  uploadDataset: (formData) => apiRequest('/datasets/upload', {
    method: 'POST',
    headers: {},
    body: formData,
  }),
  connectDatabase: (data) => apiRequest('/datasets/connect', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  testDatabase: (connectionString) => apiRequest('/datasets/test-connection', {
    method: 'POST',
    body: JSON.stringify({ connection_string: connectionString }),
  }),
  deleteDataset: (id) => apiRequest(`/datasets/${id}`, { method: 'DELETE' }),

  // Agents
  queryAgent: (sessionId, query) => apiRequest(`/agents/${sessionId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
  autopilotStart: (data) => apiRequest('/agents/02/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getAutopilotSessions: () => apiRequest('/agents/02/sessions'),
  autopilotGetSession: (id) => apiRequest(`/agents/02/sessions/${id}`),
  autopilotExport: (sessionId, format) => apiRequest(`/agents/02/${sessionId}/export/${format}`, {
    method: 'GET',
  }),
  mlStartSession: (data) => apiRequest('/agents/03/start', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  getMLSessions: () => apiRequest('/agents/03/sessions'),
  mlGetSession: (sessionId) => apiRequest(`/agents/03/session/${sessionId}`, {
    method: 'GET',
  }),
  mlExecuteSession: (sessionId) => apiRequest('/agents/03/execute', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  }),
  mlExport: (sessionId, format) => apiRequest(`/agents/03/${sessionId}/export/${format}`, {
    method: 'GET',
  }),

  // Settings
  getUserSettings: () => apiRequest('/users/settings'),
  updateUserSettings: (data) => apiRequest('/users/settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  // Handoff
  handoffToAgent01: (autopilotSessionId) => apiRequest(`/agents/01/handoff/${autopilotSessionId}`, {
    method: 'POST',
  }),

  // Import URL
  importDatasetFromUrl: (url) => apiRequest('/datasets/import-url', {
    method: 'POST',
    body: JSON.stringify({ url }),
  }),
};
