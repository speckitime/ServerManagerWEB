import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me')
};

// Server APIs
export const serverAPI = {
  list: (params) => api.get('/api/servers', { params }),
  get: (id) => api.get(`/api/servers/${id}`),
  create: (data) => api.post('/api/servers', data),
  update: (id, data) => api.put(`/api/servers/${id}`, data),
  delete: (id) => api.delete(`/api/servers/${id}`),
  getStatus: (id) => api.get(`/api/servers/${id}/status`),
  getMetrics: (id) => api.get(`/api/servers/${id}/metrics`),
  getMetricsHistory: (id, period) => api.get(`/api/servers/${id}/metrics/history`, { params: { period } }),
  getProcesses: (id) => api.get(`/api/servers/${id}/processes`),
  getNetwork: (id) => api.get(`/api/servers/${id}/network`),
  getPackages: (id, search) => api.get(`/api/servers/${id}/packages`, { params: { search } }),
  getUpdates: (id) => api.get(`/api/servers/${id}/updates`),
  scanUpdates: (id) => api.post(`/api/servers/${id}/updates/scan`),
  installUpdates: (id, packages, installAll) => api.post(`/api/servers/${id}/updates/install`, { packages, install_all: installAll }),
  getLogs: (id) => api.get(`/api/servers/${id}/logs`),
  getLogContent: (id, filename, lines) => api.get(`/api/servers/${id}/logs/${filename}`, { params: { lines } }),
  getDocumentation: (id) => api.get(`/api/servers/${id}/documentation`),
  updateDocumentation: (id, content, contentType) => api.put(`/api/servers/${id}/documentation`, { content, content_type: contentType }),
  // New extended APIs
  getHardware: (id) => api.get(`/api/servers/${id}/hardware`),
  getDisks: (id) => api.get(`/api/servers/${id}/disks`),
  getExtended: (id) => api.get(`/api/servers/${id}/extended`),
  getRdpFile: (id) => api.get(`/api/servers/${id}/rdp-file`)
};

// Task APIs
export const taskAPI = {
  list: () => api.get('/api/tasks'),
  get: (id) => api.get(`/api/tasks/${id}`),
  create: (data) => api.post('/api/tasks', data),
  update: (id, data) => api.put(`/api/tasks/${id}`, data),
  delete: (id) => api.delete(`/api/tasks/${id}`),
  execute: (id) => api.post(`/api/tasks/${id}/execute`)
};

// User APIs
export const userAPI = {
  list: () => api.get('/api/users'),
  create: (data) => api.post('/api/users', data),
  update: (id, data) => api.put(`/api/users/${id}`, data),
  delete: (id) => api.delete(`/api/users/${id}`)
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/stats'),
  getActivityLogs: (limit) => api.get('/api/activity-logs', { params: { limit } })
};

// Server Groups APIs
export const serverGroupAPI = {
  list: () => api.get('/api/server-groups'),
  create: (data) => api.post('/api/server-groups', data)
};

// IP Overview API
export const ipOverviewAPI = {
  get: () => api.get('/api/ip-overview')
};

export default api;
