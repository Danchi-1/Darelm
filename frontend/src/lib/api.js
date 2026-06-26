const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('token');
  
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
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
  connectDatabase: (data) => apiRequest('/datasets/connect', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  deleteDataset: (id) => apiRequest(`/datasets/${id}`, { method: 'DELETE' }),

  // Agents
  queryAgent: (sessionId, query) => apiRequest(`/agents/${sessionId}/query`, {
    method: 'POST',
    body: JSON.stringify({ query }),
  }),
};
