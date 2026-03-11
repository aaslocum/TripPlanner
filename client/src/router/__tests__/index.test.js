import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter, createWebHistory } from 'vue-router';

// Mock the auth store
let mockAuthState = {
  isAuthenticated: false,
  isAdmin: false,
  initialized: false,
  initialize: vi.fn(),
};

vi.mock('../../stores/auth.js', () => ({
  useAuthStore: () => mockAuthState,
}));

// Mock all view components to avoid actual imports
const MockComponent = { template: '<div>mock</div>' };

const routes = [
  { path: '/login', name: 'Login', component: MockComponent, meta: { guest: true } },
  { path: '/', redirect: '/overview' },
  { path: '/overview', name: 'Overview', component: MockComponent, meta: { requiresAuth: true } },
  { path: '/accommodations', name: 'Accommodations', component: MockComponent, meta: { requiresAuth: true } },
  { path: '/trips', name: 'Trips', component: MockComponent, meta: { requiresAuth: true, requiresAdmin: true } },
  { path: '/users', name: 'Users', component: MockComponent, meta: { requiresAuth: true, requiresAdmin: true } },
];

function createTestRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  router.beforeEach(async (to) => {
    await mockAuthState.initialize();

    if (to.meta.requiresAuth && !mockAuthState.isAuthenticated) {
      return '/login';
    }
    if (to.meta.requiresAdmin && !mockAuthState.isAdmin) {
      return '/';
    }
    if (to.meta.guest && mockAuthState.isAuthenticated) {
      return '/';
    }
  });

  return router;
}

beforeEach(() => {
  mockAuthState = {
    isAuthenticated: false,
    isAdmin: false,
    initialized: false,
    initialize: vi.fn().mockResolvedValue(undefined),
  };
});

describe('router guards', () => {
  it('redirects unauthenticated users to /login from protected routes', async () => {
    const router = createTestRouter();
    await router.push('/overview');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('allows authenticated users to access protected routes', async () => {
    mockAuthState.isAuthenticated = true;
    const router = createTestRouter();
    await router.push('/overview');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/overview');
  });

  it('redirects non-admin users from admin routes to /', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = false;
    const router = createTestRouter();
    // / redirects to /overview which requires auth (passes), then we test /trips
    await router.push('/trips');
    await router.isReady();

    // Non-admin redirected to / which redirects to /overview
    expect(router.currentRoute.value.path).toBe('/overview');
  });

  it('allows admin users to access admin routes', async () => {
    mockAuthState.isAuthenticated = true;
    mockAuthState.isAdmin = true;
    const router = createTestRouter();
    await router.push('/trips');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/trips');
  });

  it('redirects authenticated users away from guest-only routes', async () => {
    mockAuthState.isAuthenticated = true;
    const router = createTestRouter();
    await router.push('/login');
    await router.isReady();

    // Redirected to / which redirects to /overview
    expect(router.currentRoute.value.path).toBe('/overview');
  });

  it('allows unauthenticated users to access guest routes', async () => {
    const router = createTestRouter();
    await router.push('/login');
    await router.isReady();

    expect(router.currentRoute.value.path).toBe('/login');
  });

  it('calls initialize before every navigation', async () => {
    const router = createTestRouter();
    mockAuthState.isAuthenticated = true;

    await router.push('/overview');
    await router.push('/accommodations');

    expect(mockAuthState.initialize).toHaveBeenCalledTimes(2);
  });
});
