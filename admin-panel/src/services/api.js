import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Simple cache için
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 saniye timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Auth token ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // GET isteklerinde cache kontrol et
  if (config.method === 'get' && config.cache !== false) {
    const cacheKey = config.url + JSON.stringify(config.params || {});
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      config.adapter = () => Promise.resolve({
        data: cached.data,
        status: 200,
        statusText: 'OK (cached)',
        headers: {},
        config,
      });
    }
  }
  
  return config;
});

// Response interceptor - Cache kaydet
api.interceptors.response.use(
  (response) => {
    // GET isteklerini cache'le
    if (response.config.method === 'get' && response.config.cache !== false) {
      const cacheKey = response.config.url + JSON.stringify(response.config.params || {});
      cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });
    }
    return response;
  },
  (error) => {
    // 401 hatası - Token geçersiz
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Cache temizleme fonksiyonu
export const clearCache = (pattern) => {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
      }
    }
  } else {
    cache.clear();
  }
};

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
