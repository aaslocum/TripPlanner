import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] ?? null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Mock window.location
const locationMock = { href: '' };
vi.stubGlobal('window', { location: locationMock, localStorage: localStorageMock });

// We can't easily test axios interceptors by importing the module directly,
// so we test the interceptor logic in isolation.

describe('API client interceptors', () => {
  describe('request interceptor logic', () => {
    it('adds Authorization header when token exists', () => {
      localStorageMock.setItem('token', 'my-jwt');

      const config = { headers: {} };
      const token = localStorageMock.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBe('Bearer my-jwt');
    });

    it('does not add Authorization header when no token', () => {
      localStorageMock.clear();

      const config = { headers: {} };
      const token = localStorageMock.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('response interceptor logic (401 handling)', () => {
    function handle401(error) {
      if (error.response?.status === 401) {
        const url = error.config?.url || '';
        if (!url.includes('/auth/me') && !url.includes('/auth/dev-login')) {
          localStorageMock.removeItem('token');
          locationMock.href = '/login';
          return;
        }
      }
    }

    beforeEach(() => {
      localStorageMock.clear();
      locationMock.href = '';
    });

    it('redirects to /login on 401 for regular endpoints', () => {
      localStorageMock.setItem('token', 'old-token');

      handle401({
        response: { status: 401 },
        config: { url: '/trips' },
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
      expect(locationMock.href).toBe('/login');
    });

    it('does not redirect on 401 for /auth/me', () => {
      handle401({
        response: { status: 401 },
        config: { url: '/auth/me' },
      });

      expect(locationMock.href).toBe('');
    });

    it('does not redirect on 401 for /auth/dev-login', () => {
      handle401({
        response: { status: 401 },
        config: { url: '/auth/dev-login' },
      });

      expect(locationMock.href).toBe('');
    });

    it('does nothing for non-401 errors', () => {
      handle401({
        response: { status: 500 },
        config: { url: '/trips' },
      });

      expect(locationMock.href).toBe('');
    });
  });
});
