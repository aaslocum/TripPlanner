import { defineStore } from 'pinia';
import apiClient from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
    initialized: false,
    impersonating: null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isRealAdmin: (state) => state.user?.role === 'admin',
    isAdmin: (state) => {
      if (state.impersonating) return state.impersonating.role === 'admin';
      return state.user?.role === 'admin';
    },
    activeUser: (state) => state.impersonating || state.user,
    isImpersonating: (state) => !!state.impersonating,
  },

  actions: {
    impersonate(user) {
      this.impersonating = user;
    },
    stopImpersonating() {
      this.impersonating = null;
    },
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
