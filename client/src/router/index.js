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
    redirect: '/overview',
  },
  {
    path: '/overview',
    name: 'Overview',
    component: () => import('../views/OverviewView.vue'),
    meta: { requiresAuth: true },
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
    path: '/eats',
    name: 'Eats',
    component: () => import('../views/EatsView.vue'),
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
    path: '/attendees',
    name: 'Guests',
    component: () => import('../views/AttendeesView.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/trips',
    name: 'Trips',
    component: () => import('../views/TripsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('../views/UsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/travel-agent',
    name: 'TravelAgent',
    component: () => import('../views/TravelAgentView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/ai-settings',
    name: 'AiSettings',
    component: () => import('../views/AiSettingsView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true },
  },
  {
    path: '/logistics',
    name: 'Logistics',
    component: () => import('../views/LogisticsView.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Ensure auth is initialized before any guard logic
  await authStore.initialize();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login');
  } else if (to.meta.requiresAdmin && !authStore.isAdmin) {
    next('/');
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next('/');
  } else {
    next();
  }
});

export default router;
