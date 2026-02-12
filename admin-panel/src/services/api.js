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
  create: async (data) => {
    const response = await api.post('/sites', data);
    clearCache('/sites');
    return response;
  },
  update: async (siteId, data) => {
    const response = await api.put(`/sites/${siteId}`, data);
    clearCache('/sites');
    return response;
  },
  delete: async (siteId) => {
    const response = await api.delete(`/sites/${siteId}`);
    clearCache('/sites');
    return response;
  },
  regenerateKey: async (siteId) => {
    const response = await api.post(`/sites/${siteId}/regenerate-key`);
    clearCache('/sites');
    return response;
  },
};

// FAQs API
export const faqsAPI = {
  getAll: (siteId) => api.get(`/faqs/admin/${siteId}`),
  create: async (data) => {
    const response = await api.post('/faqs/admin', data);
    clearCache('/faqs');
    return response;
  },
  update: async (faqId, data) => {
    const response = await api.put(`/faqs/admin/${faqId}`, data);
    clearCache('/faqs');
    return response;
  },
  delete: async (faqId) => {
    const response = await api.delete(`/faqs/admin/${faqId}`);
    clearCache('/faqs');
    return response;
  },
};

// Conversations API
export const conversationsAPI = {
  getAll: (siteId, status) => api.get(`/conversations/${siteId}`, { params: { status } }),
  getOne: (siteId, conversationId) => api.get(`/conversations/${siteId}/${conversationId}`),
  assign: async (conversationId, agentId, assignedBy) => {
    const response = await api.put(`/conversations/${conversationId}/assign`, { agentId, assignedBy });
    clearCache('/conversations');
    return response;
  },
  claim: async (conversationId) => {
    const response = await api.put(`/conversations/${conversationId}/claim`);
    clearCache('/conversations');
    return response;
  },
  setDepartment: async (conversationId, departmentId) => {
    const response = await api.put(`/conversations/${conversationId}/department`, { departmentId });
    clearCache('/conversations');
    return response;
  },
  setPriority: async (conversationId, priority) => {
    const response = await api.put(`/conversations/${conversationId}/priority`, { priority });
    clearCache('/conversations');
    return response;
  },
  addNote: async (conversationId, note) => {
    const response = await api.post(`/conversations/${conversationId}/notes`, { note });
    clearCache('/conversations');
    return response;
  },
  updateStatus: async (conversationId, status) => {
    const response = await api.put(`/conversations/${conversationId}/status`, { status });
    clearCache('/conversations');
    return response;
  },
  delete: async (siteId, conversationId) => {
    const response = await api.delete(`/conversations/${siteId}/${conversationId}`);
    clearCache('/conversations');
    return response;
  },
  getUnreadCount: () => api.get('/conversations/unread-count'),
};

// Departments API
export const departmentsAPI = {
  getAll: (siteId) => api.get(`/departments/site/${siteId}`),
  getOne: (departmentId) => api.get(`/departments/${departmentId}`),
  create: async (data) => {
    const response = await api.post('/departments', data);
    clearCache('/departments');
    return response;
  },
  update: async (departmentId, data) => {
    const response = await api.put(`/departments/${departmentId}`, data);
    clearCache('/departments');
    return response;
  },
  delete: async (departmentId) => {
    const response = await api.delete(`/departments/${departmentId}`);
    clearCache('/departments'); // Clear cache after delete
    return response;
  },
  addMember: async (departmentId, userId, role) => {
    const response = await api.post(`/departments/${departmentId}/members`, { userId, role });
    clearCache('/departments'); // Clear cache after adding member
    return response;
  },
  removeMember: async (departmentId, userId) => {
    const response = await api.delete(`/departments/${departmentId}/members/${userId}`);
    clearCache('/departments'); // Clear cache after removing member
    return response;
  },
  getStats: (departmentId) => api.get(`/departments/${departmentId}/stats`),
};

// Team API
export const teamAPI = {
  getAll: (siteId) => api.get('/team', { params: { siteId } }),
  getOne: (userId) => api.get(`/team/${userId}`),
  create: async (data) => {
    const response = await api.post('/team', data);
    clearCache('/team'); // Clear cache after create
    return response;
  },
  update: async (userId, data) => {
    const response = await api.put(`/team/${userId}`, data);
    clearCache('/team'); // Clear cache after update
    return response;
  },
  updateStatus: async (userId, status) => {
    const response = await api.patch(`/team/${userId}/status`, { status });
    clearCache('/team'); // Clear cache after status update
    return response;
  },
  delete: async (userId) => {
    const response = await api.delete(`/team/${userId}`);
    clearCache('/team'); // Clear cache after delete
    return response;
  },
  getStats: (userId) => api.get(`/team/${userId}/stats`),
};

export default api;
