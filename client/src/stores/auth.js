import { defineStore } from 'pinia';
import apiClient from '../api/client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    token: localStorage.getItem('token') || null,
  }),

  getters: {
    isAuthenticated: (state) => !!state.user,
    isAdmin: (state) => state.user?.role === 'admin',
  },

  actions: {
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
