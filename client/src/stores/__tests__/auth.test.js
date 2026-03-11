import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// Mock apiClient
const mockGet = vi.fn();
vi.mock('../../api/client.js', () => ({
  default: {
    get: (...args) => mockGet(...args),
  },
}));

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

const { useAuthStore } = await import('../auth.js');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  localStorageMock.clear();
});

describe('auth store', () => {
  describe('initial state', () => {
    it('starts with no user and not authenticated', () => {
      const store = useAuthStore();
      expect(store.user).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(store.isAdmin).toBe(false);
      expect(store.initialized).toBe(false);
    });
  });

  describe('setToken', () => {
    it('stores token in state and localStorage', () => {
      const store = useAuthStore();
      store.setToken('my-jwt-token');
      expect(store.token).toBe('my-jwt-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('token', 'my-jwt-token');
    });
  });

  describe('logout', () => {
    it('clears user, token, and localStorage', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'admin' };
      store.token = 'some-token';

      store.logout();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
    });
  });

  describe('initialize', () => {
    it('fetches user when token exists', async () => {
      const store = useAuthStore();
      store.token = 'valid-token';
      mockGet.mockResolvedValue({ data: { data: { user_id: 1, role: 'admin', first_name: 'Alex' } } });

      await store.initialize();

      expect(store.user).toEqual({ user_id: 1, role: 'admin', first_name: 'Alex' });
      expect(store.initialized).toBe(true);
      expect(store.isAuthenticated).toBe(true);
    });

    it('clears token on failed fetch', async () => {
      const store = useAuthStore();
      store.token = 'invalid-token';
      mockGet.mockRejectedValue(new Error('401'));

      await store.initialize();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.initialized).toBe(true);
    });

    it('skips fetch when no token', async () => {
      const store = useAuthStore();
      store.token = null;

      await store.initialize();

      expect(store.initialized).toBe(true);
      expect(mockGet).not.toHaveBeenCalled();
    });

    it('only initializes once', async () => {
      const store = useAuthStore();
      store.token = 'token';
      mockGet.mockResolvedValue({ data: { data: { user_id: 1 } } });

      await store.initialize();
      await store.initialize();

      expect(mockGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('getters', () => {
    it('isAuthenticated returns true when user exists', () => {
      const store = useAuthStore();
      store.user = { user_id: 1 };
      expect(store.isAuthenticated).toBe(true);
    });

    it('isAdmin returns true for admin user', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'admin' };
      expect(store.isAdmin).toBe(true);
    });

    it('isAdmin returns false for regular user', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'user' };
      expect(store.isAdmin).toBe(false);
    });

    it('isRealAdmin stays true during impersonation', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'admin' };
      store.impersonate({ user_id: 2, role: 'user' });

      expect(store.isRealAdmin).toBe(true);
      expect(store.isAdmin).toBe(false); // impersonated user is not admin
    });

    it('activeUser returns impersonated user when impersonating', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'admin' };
      const impUser = { user_id: 2, role: 'user' };
      store.impersonate(impUser);

      expect(store.activeUser).toEqual(impUser);
      expect(store.isImpersonating).toBe(true);
    });

    it('stopImpersonating restores original user', () => {
      const store = useAuthStore();
      store.user = { user_id: 1, role: 'admin' };
      store.impersonate({ user_id: 2, role: 'user' });
      store.stopImpersonating();

      expect(store.isImpersonating).toBe(false);
      expect(store.activeUser).toEqual({ user_id: 1, role: 'admin' });
      expect(store.isAdmin).toBe(true);
    });
  });

  describe('fetchCurrentUser', () => {
    it('updates user on success', async () => {
      const store = useAuthStore();
      mockGet.mockResolvedValue({ data: { data: { user_id: 1, first_name: 'Alex' } } });

      await store.fetchCurrentUser();

      expect(store.user).toEqual({ user_id: 1, first_name: 'Alex' });
    });

    it('clears user and token on failure', async () => {
      const store = useAuthStore();
      store.token = 'old-token';
      store.user = { user_id: 1 };
      mockGet.mockRejectedValue(new Error('401'));

      await store.fetchCurrentUser();

      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
    });
  });
});
