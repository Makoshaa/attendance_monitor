import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor для добавления JWT токена из sessionStorage (для мобильных устройств)
api.interceptors.request.use(
  (config) => {
    const mobileJwt = sessionStorage.getItem('mobile_jwt');
    if (mobileJwt) {
      config.headers.Authorization = `Bearer ${mobileJwt}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;
