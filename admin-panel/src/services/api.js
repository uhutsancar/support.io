import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// Sites API
export const sitesAPI = {
  getAll: () => api.get('/sites'),
  getOne: (siteId) => api.get(`/sites/${siteId}`),
  create: (data) => api.post('/sites', data),
  update: (siteId, data) => api.put(`/sites/${siteId}`, data),
  delete: (siteId) => api.delete(`/sites/${siteId}`),
  regenerateKey: (siteId) => api.post(`/sites/${siteId}/regenerate-key`),
};

// FAQs API
export const faqsAPI = {
  getAll: (siteId) => api.get(`/faqs/admin/${siteId}`),
  create: (data) => api.post('/faqs/admin', data),
  update: (faqId, data) => api.put(`/faqs/admin/${faqId}`, data),
  delete: (faqId) => api.delete(`/faqs/admin/${faqId}`),
};

// Conversations API
export const conversationsAPI = {
  getAll: (siteId, status) => api.get(`/conversations/${siteId}`, { params: { status } }),
  getOne: (siteId, conversationId) => api.get(`/conversations/${siteId}/${conversationId}`),
  assign: (conversationId, agentId) => api.put(`/conversations/${conversationId}/assign`, { agentId }),
  updateStatus: (conversationId, status) => api.put(`/conversations/${conversationId}/status`, { status }),
};

export default api;
