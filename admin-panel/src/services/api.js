import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL + '/api';

const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
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

api.interceptors.response.use(
  (response) => {
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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

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

export const conversationsAPI = {
  getAll: (siteId, status) => {
    if (!siteId) {
      // avoid invalid requests; return empty list
      return Promise.resolve({ data: { conversations: [] } });
    }
    return api.get(`/conversations/${siteId}`, { params: { status } });
  },
  getOne: (siteId, conversationId) => {
    if (!siteId || !conversationId) {
      return Promise.reject(new Error('Missing siteId or conversationId'));
    }
    return api.get(`/conversations/${siteId}/${conversationId}`);
  },
  getAssigned: () => api.get('/conversations/assigned/me'),
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
  updatePriority: async (conversationId, priority) => {
    const response = await api.put(`/conversations/${conversationId}/priority`, { priority });
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
    clearCache('/departments');
    return response;
  },
  addMember: async (departmentId, userId, role) => {
    const response = await api.post(`/departments/${departmentId}/members`, { userId, role });
    clearCache('/departments');
    return response;
  },
  removeMember: async (departmentId, userId) => {
    const response = await api.delete(`/departments/${departmentId}/members/${userId}`);
    clearCache('/departments');
    return response;
  },
  getStats: (departmentId) => api.get(`/departments/${departmentId}/stats`),
};

export const teamAPI = {
  getAll: (siteId) => api.get('/team', { params: { siteId } }),
  getOne: (userId) => api.get(`/team/${userId}`),
  create: async (data) => {
    const response = await api.post('/team', data);
    clearCache('/team');
    return response;
  },
  update: async (userId, data) => {
    const response = await api.put(`/team/${userId}`, data);
    clearCache('/team');
    return response;
  },
  updateStatus: async (userId, status) => {
    const response = await api.patch(`/team/${userId}/status`, { status });
    clearCache('/team');
    return response;
  },
  delete: async (userId) => {
    const response = await api.delete(`/team/${userId}`);
    clearCache('/team');
    return response;
  },
  getStats: (userId) => api.get(`/team/${userId}/stats`),
};

export const teamChatAPI = {
  getChats: () => api.get('/team-chat/chats', { cache: false }),
  createDirect: (targetUserId) => api.post('/team-chat/chats/direct', { targetUserId }),
  createGroup: (name, participantIds) => api.post('/team-chat/chats/group', { name, participantIds }),
  getMessages: (chatId, limit) => api.get(`/team-chat/chats/${chatId}/messages`, { params: { limit }, cache: false }),
  getMembers: () => api.get('/team-chat/members', { cache: false }),
  getUnread: () => api.get('/team-chat/unread', { cache: false }),
  deleteMessage: (messageId) => api.delete(`/team-chat/messages/${messageId}`),
};

export const widgetConfigAPI = {
  getConfig: (siteId) => api.get(`/widget-config/site/${siteId}`, { cache: false }),
  updateConfig: async (siteId, data) => {
    const response = await api.put(`/widget-config/site/${siteId}`, data);
    clearCache('/widget-config');
    return response;
  },
  uploadLogo: async (siteId, file) => {
    const formData = new FormData();
    formData.append('logo', file);
    const response = await api.post(`/widget-config/site/${siteId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    clearCache('/widget-config');
    return response;
  },
  deleteLogo: async (siteId) => {
    const response = await api.delete(`/widget-config/site/${siteId}/logo`);
    clearCache('/widget-config');
    return response;
  },
  getPublicConfig: (siteKey) => api.get(`/widget-config/public/${siteKey}`, { cache: false }),
};

export const auditAPI = {
  // params: { action, start, end, page, limit }
  getAll: (params) => api.get('/audit', { params })
};

export default api;
