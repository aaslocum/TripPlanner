<script setup>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import apiClient from '../api/client';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const error = ref(route.query.error || '');
const devBypassAvailable = ref(false);
const devLoading = ref(false);

onMounted(async () => {
  // Check if dev bypass is available (don't auto-login)
  try {
    const { data } = await apiClient.get('/auth/dev-status');
    devBypassAvailable.value = data.data?.devBypass === true;
  } catch {
    // Not available
  }
});

function loginWithGoogle() {
  window.location.href = '/api/auth/google';
}

async function devLogin() {
  devLoading.value = true;
  try {
    const { data } = await apiClient.get('/auth/dev-login');
    if (data.success) {
      authStore.setToken(data.data.token);
      authStore.user = data.data.user;
      router.push('/');
    }
  } catch (err) {
    error.value = 'Dev login failed';
  } finally {
    devLoading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen bg-flag-black">

    <!-- Sticky Nav Bar -->
    <nav class="sticky top-0 z-50 bg-flag-black/95 backdrop-blur border-b border-white/10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-flag-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-display font-bold text-white uppercase tracking-wide text-sm">Framily Trip Planner</span>
        </div>
        <button
          @click="loginWithGoogle"
          class="bg-flag-red hover:bg-flag-red-hover text-white text-xs font-display font-bold uppercase tracking-wider px-5 py-2 rounded-full transition-colors"
        >
          Sign In
        </button>
      </div>
    </nav>

    <!-- Hero Section -->
    <section class="bg-flag-black">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div class="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          <!-- Left: Copy -->
          <div class="flex-1 text-center md:text-left">
            <div class="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
              <span class="inline-flex items-center gap-1.5 bg-white/10 text-white/90 text-xs font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                <span class="w-2 h-2 rounded-full bg-flag-green"></span>
                Better Than A PDF
              </span>
              <span class="inline-flex items-center gap-1.5 bg-white/10 text-white/90 text-xs font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                <span class="w-2 h-2 rounded-full bg-flag-yellow"></span>
                Zero Group Chat Chaos
              </span>
            </div>

            <h1 class="font-display font-black text-4xl sm:text-5xl md:text-6xl uppercase leading-[1.05] text-white mb-6">
              Stop Planning Trips In
              <span class="text-flag-red"> The Group Chat.</span>
            </h1>

            <p class="text-white/60 text-lg md:text-xl leading-relaxed mb-8 max-w-xl mx-auto md:mx-0">
              One place for accommodations, activities, room assignments, and a travel agent that actually knows your trip. Built for friend groups who are tired of spreadsheets.
            </p>

            <button
              @click="loginWithGoogle"
              class="inline-flex items-center gap-3 bg-flag-red hover:bg-flag-red-hover text-white font-display font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" fill-opacity="0.8"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fill-opacity="0.9"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fill-opacity="0.7"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fill-opacity="0.8"/>
              </svg>
              Sign In With Google
            </button>

            <button
              v-if="devBypassAvailable"
              @click="devLogin"
              :disabled="devLoading"
              class="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-display font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-lg transition-colors ml-3 disabled:opacity-50"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {{ devLoading ? 'Signing in...' : 'Dev Sign In' }}
            </button>

            <!-- Error messages -->
            <p v-if="error === 'not_registered'" class="text-red-400 text-sm mt-4">
              Your account is not registered. Contact the trip admin for access.
            </p>
            <p v-else-if="error" class="text-red-400 text-sm mt-4">
              Sign in failed. Please try again.
            </p>
          </div>

          <!-- Right: Product mockup -->
          <div class="flex-1 max-w-sm md:max-w-md w-full">
            <div class="bg-warm-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <!-- Mock header -->
              <div class="bg-white/5 px-4 py-2.5 border-b border-white/10 flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span class="text-white/60 text-xs font-display font-bold uppercase tracking-wider">Itinerary</span>
                <span class="ml-auto text-white/30 text-xs">Weekend Getaway</span>
              </div>
              <!-- Mock itinerary events -->
              <div class="p-4 space-y-2.5">
                <div class="flex gap-3 items-start">
                  <span class="text-xs text-white/40 font-mono w-12 pt-1 shrink-0">3:00 PM</span>
                  <div class="flex-1 bg-green-500/15 border-l-2 border-green-500 rounded-r-lg px-3 py-2">
                    <p class="text-white/90 text-sm font-medium">Check-in at Airbnb</p>
                    <p class="text-white/40 text-xs">Mountain View Cabin</p>
                  </div>
                </div>
                <div class="flex gap-3 items-start">
                  <span class="text-xs text-white/40 font-mono w-12 pt-1 shrink-0">5:00 PM</span>
                  <div class="flex-1 bg-blue-500/15 border-l-2 border-blue-500 rounded-r-lg px-3 py-2">
                    <p class="text-white/90 text-sm font-medium">Sunset Hike — Eagle Trail</p>
                    <p class="text-white/40 text-xs">6 attending · ~2h</p>
                  </div>
                </div>
                <div class="flex gap-3 items-start">
                  <span class="text-xs text-white/40 font-mono w-12 pt-1 shrink-0">7:30 PM</span>
                  <div class="flex-1 bg-orange-500/15 border-l-2 border-orange-500 rounded-r-lg px-3 py-2">
                    <p class="text-white/90 text-sm font-medium">Dinner — The Rustic Table</p>
                    <p class="text-white/40 text-xs">Reservation for 8 · $35/pp</p>
                  </div>
                </div>
                <div class="flex gap-3 items-start">
                  <span class="text-xs text-white/40 font-mono w-12 pt-1 shrink-0">9:30 PM</span>
                  <div class="flex-1 bg-purple-500/15 border-l-2 border-purple-500 rounded-r-lg px-3 py-2">
                    <p class="text-white/90 text-sm font-medium">Board Games Night</p>
                    <p class="text-white/40 text-xs">At the cabin · BYOB</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- How It Works -->
    <section class="bg-surface-page">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div class="text-center mb-12">
          <span class="text-xs font-display font-bold uppercase tracking-[0.2em] text-flag-green mb-3 block">How It Works</span>
          <h2 class="font-display font-black text-3xl md:text-4xl uppercase tracking-wide text-flag-black">
            Three Steps. No Spreadsheets Required.
          </h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <!-- Step 1 -->
          <div class="bg-surface rounded-2xl p-6 md:p-8 border border-warm-200">
            <span class="text-xs font-display font-bold uppercase tracking-wider text-warm-400 block mb-3">01 — Create Your Trip</span>
            <h3 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black mb-3">Set Up Everything</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              Set your dates, pick your destination. Add the Airbnb. Drop in activities. Your travel agent handles the rest.
            </p>
          </div>
          <!-- Step 2 -->
          <div class="bg-surface rounded-2xl p-6 md:p-8 border border-warm-200">
            <span class="text-xs font-display font-bold uppercase tracking-wider text-warm-400 block mb-3">02 — Invite The Crew</span>
            <h3 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black mb-3">One Link. Done.</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              Drop it in the group chat. Everyone RSVPs, claims a bed, and sets their travel dates. No back-and-forth required.
            </p>
          </div>
          <!-- Step 3 -->
          <div class="bg-surface rounded-2xl p-6 md:p-8 border border-warm-200">
            <span class="text-xs font-display font-bold uppercase tracking-wider text-warm-400 block mb-3">03 — Enjoy The Trip</span>
            <h3 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black mb-3">Everything In One Place</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              Shared itinerary, room assignments, restaurant plans — all in one place. No more "where are we eating tonight?" texts.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Feature Highlights -->
    <section class="bg-surface-page border-t border-warm-200">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-flag-black/5 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-flag-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-base uppercase tracking-wide text-flag-black mb-2">Smart Travel Agent</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              Ask the travel agent to find restaurants, plan activities, or update your logistics. Page-aware and trip-context-aware.
            </p>
          </div>
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-flag-black/5 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-flag-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-base uppercase tracking-wide text-flag-black mb-2">Room & Bed Claims</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              See the floor plan, claim your bed, split costs fairly. No awkward conversations.
            </p>
          </div>
          <div class="text-center">
            <div class="w-14 h-14 rounded-2xl bg-flag-black/5 flex items-center justify-center mx-auto mb-4">
              <svg class="w-7 h-7 text-flag-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 class="font-display font-bold text-base uppercase tracking-wide text-flag-black mb-2">Live Itinerary</h3>
            <p class="text-warm-500 text-sm leading-relaxed">
              Everything on one timeline. Check-ins, activities, dining — grouped by day with attendance counts.
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Final CTA -->
    <section class="bg-flag-black border-t border-white/10">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <h2 class="font-display font-black text-3xl md:text-4xl uppercase tracking-wide text-white mb-4">
          Your Next Trip Deserves Better Than A Spreadsheet.
        </h2>
        <p class="text-white/50 text-lg mb-8 max-w-xl mx-auto">
          Join your crew on Framily Trip Planner. One sign-in, and you're ready to go.
        </p>
        <button
          @click="loginWithGoogle"
          class="inline-flex items-center gap-3 bg-flag-red hover:bg-flag-red-hover text-white font-display font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-lg transition-colors w-full sm:w-auto justify-center"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" fill-opacity="0.8"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fill-opacity="0.9"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fill-opacity="0.7"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fill-opacity="0.8"/>
          </svg>
          Sign In With Google
        </button>
        <button
          v-if="devBypassAvailable"
          @click="devLogin"
          :disabled="devLoading"
          class="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-display font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-lg transition-colors w-full sm:w-auto justify-center mt-3 sm:mt-0 sm:ml-3 disabled:opacity-50"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {{ devLoading ? 'Signing in...' : 'Dev Sign In' }}
        </button>
        <!-- Error messages -->
        <p v-if="error === 'not_registered'" class="text-red-400 text-sm mt-4">
          Your account is not registered. Contact the trip admin for access.
        </p>
        <p v-else-if="error" class="text-red-400 text-sm mt-4">
          Sign in failed. Please try again.
        </p>
      </div>
    </section>

    <!-- Footer -->
    <footer class="bg-flag-black border-t border-white/10">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="font-display font-bold text-white/60 uppercase tracking-wider text-xs">Framily Trip Planner</span>
        </div>
        <p class="text-white/30 text-xs">Built for friend groups. Not for travel agencies.</p>
      </div>
    </footer>

  </div>
</template>
