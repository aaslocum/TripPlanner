import { defineStore } from 'pinia';
import apiClient from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
    initialized: false,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
  },

  actions: {
    async initialize() {
      if (this.initialized) return;
      try {
        // Try fetching current user (works in bypass mode without token)
        const { data } = await apiClient.get('/auth/me');
        this.user = data.data;
      } catch {
        // Try dev-login endpoint
        try {
          const { data } = await apiClient.get('/auth/dev-login');
          if (data.success) {
            this.token = data.data.token;
            localStorage.setItem('token', data.data.token);
            this.user = data.data.user;
          }
        } catch {
          this.user = null;
        }
      }
      this.initialized = true;
    },

    async fetchCurrentUser() {
      try {
        const { data } = await apiClient.get('/auth/me');
        this.user = data.data;
      } catch {
        this.user = null;
        this.token = null;
        localStorage.removeItem('token');
      }
    },

    setToken(token) {
      this.token = token;
      localStorage.setItem('token', token);
    },

    logout() {
      this.user = null;
      this.token = null;
      localStorage.removeItem('token');
    },
  },
});
