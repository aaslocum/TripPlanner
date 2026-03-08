import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { guest: true },
  },
  {
    path: '/auth/callback',
    name: 'AuthCallback',
    component: () => import('../views/AuthCallbackView.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    redirect: '/accommodations',
  },
  {
    path: '/accommodations',
    name: 'Accommodations',
    component: () => import('../views/AccommodationsView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/activities',
    name: 'Activities',
    component: () => import('../views/ActivitiesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/itinerary',
    name: 'Itinerary',
    component: () => import('../views/ItineraryView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/map',
    name: 'Map',
    component: () => import('../views/MapView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/UsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && authStore.user?.role !== 'admin') {
    next('/');
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

export default router;
