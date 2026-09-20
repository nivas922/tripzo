import axios from 'axios';

// Get backend URL from environment, or fallback to current origin, or localhost:5000
const rawUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
export const API_BASE_URL = rawUrl.replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to all requests if logged in
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tripzo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Global response error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear expired credentials
      localStorage.removeItem('tripzo_token');
      localStorage.removeItem('tripzo_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (userData) => api.post('/api/auth/register', userData),
  getMe: () => api.get('/api/auth/me'),
};

export const studentApi = {
  getMyBus: () => api.get('/api/students/me/bus'),
  getMyRoute: () => api.get('/api/students/me/route'),
  getMyProfile: () => api.get('/api/students/me'),
};

export const driverApi = {
  getCurrentTrip: () => api.get('/api/trips/current'),
  startTrip: (busId, direction = 'MORNING', routeId) =>
    api.post('/api/trips/start', { busId, direction, routeId }),
  pauseTrip: (tripId) => api.post(`/api/trips/${tripId}/pause`),
  resumeTrip: (tripId) => api.post(`/api/trips/${tripId}/resume`),
  endTrip: (tripId) => api.post('/api/trips/end', { tripId }),
  updateLocation: (data) => api.post('/api/location/update', data),
};

export const adminApi = {
  // Buses
  getBuses: () => api.get('/api/admin/buses'),
  createBus: (data) => api.post('/api/admin/buses', data),
  updateBus: (id, data) => api.put(`/api/admin/buses/${id}`, data),
  deleteBus: (id) => api.delete(`/api/admin/buses/${id}`),

  // Drivers
  getDrivers: () => api.get('/api/admin/drivers'),

  // Students
  getStudents: () => api.get('/api/admin/students'),
  assignStudent: (id, data) => api.put(`/api/admin/students/${id}/assignment`, data),

  // Routes & Stops
  getRoutes: () => api.get('/api/admin/routes'),
  createRoute: (data) => api.post('/api/admin/routes', data),
  updateRoute: (id, data) => api.put(`/api/admin/routes/${id}`, data),
  deleteRoute: (id) => api.delete(`/api/admin/routes/${id}`),
  addStop: (routeId, data) => api.post(`/api/admin/routes/${routeId}/stops`, data),
  deleteStop: (id) => api.delete(`/api/admin/stops/${id}`),

  // Trips
  getAllTrips: (params) => api.get('/api/trips', { params }),
};

export default api;
