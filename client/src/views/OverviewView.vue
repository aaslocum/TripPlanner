<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();

const accommodationCount = ref(0);
const activityCount = ref(0);
const attendeeCount = ref(0);
const generating = ref(false);

// Modal state
const showModal = ref(false);
const customContext = ref('');
const contextTextarea = ref(null);

// Edit mode state
const editMode = ref(false);
const editDraft = ref(null);
const saving = ref(false);

const trip = computed(() => tripStore.selectedTrip);

// Parse the description JSON; returns null if missing or invalid
const overviewData = computed(() => {
  const desc = trip.value?.description;
  if (!desc) return null;
  try {
    const parsed = JSON.parse(desc);
    if (!parsed.hook && !parsed.cards && !parsed.highlights) return null;
    return parsed;
  } catch {
    return null;
  }
});

const dayCount = computed(() => {
  if (!trip.value?.start_date || !trip.value?.end_date) return 0;
  const start = new Date(trip.value.start_date + 'T00:00:00');
  const end   = new Date(trip.value.end_date   + 'T00:00:00');
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
});

function formatDateRange(start, end) {
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return `Starting ${fmt(start)}`;
  return '';
}

const BADGE_COLORS = {
  green:  'bg-trip-accent',
  yellow: 'bg-flag-yellow',
  red:    'bg-flag-red',
  purple: 'bg-flag-purple',
};
function badgeDotClass(color) {
  return BADGE_COLORS[color] || 'bg-white/60';
}

async function fetchStats() {
  if (!tripStore.selectedTripId) return;
  try {
    const [accom, activities, members] = await Promise.all([
      apiClient.get(`/accommodations/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/activities/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/trips/${tripStore.selectedTripId}/members`),
    ]);
    accommodationCount.value = accom.data.data?.length || 0;
    activityCount.value      = activities.data.data?.length || 0;
    attendeeCount.value      = (members.data.data || []).filter(m => m.rsvp_status === 'yes').length;
  } catch { /* fail silently */ }
}

// Open the prompt modal; focus the textarea after render
function openModal() {
  customContext.value = '';
  showModal.value = true;
  nextTick(() => contextTextarea.value?.focus());
}

function cancelModal() {
  showModal.value = false;
  customContext.value = '';
}

async function confirmGenerate() {
  if (!tripStore.selectedTripId) return;
  showModal.value = false;
  generating.value = true;
  try {
    await tripStore.generateDescription(tripStore.selectedTripId, customContext.value);
  } catch (err) {
    alert('Failed to generate overview: ' + (err.response?.data?.error?.message || err.message));
  } finally {
    generating.value = false;
    customContext.value = '';
  }
}

function startEdit() {
  editDraft.value = JSON.parse(JSON.stringify(overviewData.value));
  editMode.value = true;
}

function cancelEdit() {
  editMode.value = false;
  editDraft.value = null;
}

async function saveEdit() {
  saving.value = true;
  try {
    await tripStore.updateTrip(tripStore.selectedTripId, {
      description: JSON.stringify(editDraft.value),
    });
    editMode.value = false;
    editDraft.value = null;
  } catch (err) {
    alert('Failed to save: ' + (err.response?.data?.error?.message || err.message));
  } finally {
    saving.value = false;
  }
}

onMounted(fetchStats);
watch(() => tripStore.selectedTripId, () => { cancelEdit(); fetchStats(); });
</script>

<template>
  <!-- ───────────────────────────────────────────────────────────── -->
  <!-- NO TRIP SELECTED                                              -->
  <!-- ───────────────────────────────────────────────────────────── -->
  <div v-if="!trip" class="text-center py-16">
    <div class="text-4xl mb-3">✈️</div>
    <h2 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black dark:text-warm-100 mb-2">No Trip Selected</h2>
    <p class="text-warm-500 dark:text-warm-400 text-sm">Select a trip from the dropdown above to see its overview.</p>
  </div>

  <!-- ───────────────────────────────────────────────────────────── -->
  <!-- MAIN LAYOUT                                                    -->
  <!-- ───────────────────────────────────────────────────────────── -->
  <div v-else>

    <!-- ═══ HERO (dark) ══════════════════════════════════════════ -->
    <section class="-mx-4 md:-mx-6 -mt-4 md:-mt-6 bg-flag-black">
      <!-- Optional hero image banner -->
      <div v-if="trip.image_url" class="relative h-48 md:h-72 overflow-hidden">
        <img :src="trip.image_url" :alt="trip.trip_name" class="w-full h-full object-cover opacity-50" />
        <div class="absolute inset-0 bg-gradient-to-b from-transparent to-flag-black"></div>
      </div>

      <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-12 md:pb-16">
        <!-- Badges (from AI) -->
        <div v-if="(editMode ? editDraft : overviewData)?.badges?.length" class="flex flex-wrap gap-2 mb-6">
          <span
            v-for="(badge, i) in (editMode ? editDraft : overviewData).badges"
            :key="i"
            class="inline-flex items-center gap-1.5 bg-white/10 text-white/90 text-xs font-display font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
          >
            <span class="w-2 h-2 rounded-full" :class="badgeDotClass(badge.color)"></span>
            <input
              v-if="editMode"
              v-model="editDraft.badges[i].label"
              class="bg-transparent border-b border-white/30 focus:border-white/70 outline-none w-24 text-xs font-display font-bold uppercase tracking-wider text-white/90"
            />
            <template v-else>{{ badge.label }}</template>
          </span>
        </div>

        <!-- Trip name -->
        <h1 class="font-display font-black text-4xl sm:text-5xl md:text-6xl uppercase leading-[1.05] text-white mb-3">
          {{ trip.trip_name }}
        </h1>

        <!-- Dates -->
        <p class="text-white/50 text-base md:text-lg mb-6">
          {{ formatDateRange(trip.start_date, trip.end_date) }}
        </p>

        <!-- Hook paragraph (from AI) -->
        <textarea
          v-if="editMode && editDraft?.hook != null"
          v-model="editDraft.hook"
          rows="3"
          class="w-full max-w-2xl mb-10 bg-white/10 border border-white/20 focus:border-white/50 rounded-lg px-3 py-2 text-white/90 text-lg md:text-xl leading-relaxed outline-none resize-none"
        ></textarea>
        <p v-else-if="overviewData?.hook" class="text-white/70 text-lg md:text-xl leading-relaxed max-w-2xl mb-10">
          {{ overviewData.hook }}
        </p>

        <!-- Stats row -->
        <div class="grid grid-cols-4 gap-4 max-w-sm md:max-w-md">
          <div class="text-center">
            <div class="text-3xl md:text-4xl font-display font-black text-trip-accent">{{ dayCount }}</div>
            <div class="text-xs font-display font-bold uppercase tracking-wider text-white/40 mt-1">Days</div>
          </div>
          <div class="text-center">
            <div class="text-3xl md:text-4xl font-display font-black text-cat-stays">{{ accommodationCount }}</div>
            <div class="text-xs font-display font-bold uppercase tracking-wider text-white/40 mt-1">{{ accommodationCount === 1 ? 'Stay' : 'Stays' }}</div>
          </div>
          <div class="text-center">
            <div class="text-3xl md:text-4xl font-display font-black text-cat-activities">{{ activityCount }}</div>
            <div class="text-xs font-display font-bold uppercase tracking-wider text-white/40 mt-1">Activities</div>
          </div>
          <div class="text-center">
            <div class="text-3xl md:text-4xl font-display font-black text-trip-accent">{{ attendeeCount }}</div>
            <div class="text-xs font-display font-bold uppercase tracking-wider text-white/40 mt-1">Attending</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ NO DESCRIPTION YET ═══════════════════════════════════ -->
    <section v-if="!overviewData" class="-mx-4 md:-mx-6 bg-surface-page dark:bg-dark-bg">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
        <div class="text-4xl mb-4">✨</div>
        <h3 class="font-display font-bold text-2xl uppercase tracking-wide text-flag-black dark:text-warm-100 mb-3">
          {{ authStore.isAdmin ? 'Generate This Trip\'s Overview' : 'Overview Coming Soon' }}
        </h3>
        <p class="text-warm-500 dark:text-warm-400 text-base max-w-md mx-auto mb-6">
          {{ authStore.isAdmin
            ? 'Let the AI build a sell-sheet from your trip data — accommodation, activities, and vibe — in seconds.'
            : 'The trip organizer hasn\'t added an overview yet. Check back soon!' }}
        </p>
        <button
          v-if="authStore.isAdmin"
          @click="openModal"
          :disabled="generating"
          class="inline-flex items-center gap-2 bg-flag-black hover:bg-warm-800 text-white font-display font-bold uppercase tracking-wider text-sm px-8 py-4 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg v-if="generating" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
          </svg>
          {{ generating ? 'Generating...' : '✨ Generate Overview' }}
        </button>
      </div>
    </section>

    <!-- ═══ CARDS SECTION (light) ════════════════════════════════ -->
    <section v-if="(editMode ? editDraft : overviewData)?.cards?.length" class="-mx-4 md:-mx-6 bg-surface-page dark:bg-dark-bg">
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <div class="text-center mb-10 md:mb-14">
          <span class="text-xs font-display font-bold uppercase tracking-[0.2em] text-trip-accent mb-3 block">What's On Deck</span>
          <h2 class="font-display font-black text-3xl md:text-4xl uppercase tracking-wide text-flag-black dark:text-warm-100">
            Here's What's Planned.
          </h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <div
            v-for="(card, i) in (editMode ? editDraft : overviewData).cards"
            :key="card.step"
            class="bg-surface dark:bg-dark-surface rounded-2xl p-6 md:p-8 border border-warm-200 dark:border-dark-border"
          >
            <span class="text-xs font-display font-bold uppercase tracking-wider text-warm-400 dark:text-warm-500 block mb-3">{{ card.step }}</span>
            <template v-if="editMode">
              <input
                v-model="editDraft.cards[i].title"
                class="w-full font-display font-bold text-lg uppercase tracking-wide text-flag-black dark:text-warm-100 bg-transparent border-b border-warm-300 dark:border-dark-border focus:border-trip-accent outline-none mb-3"
              />
              <textarea
                v-model="editDraft.cards[i].body"
                rows="3"
                class="w-full text-warm-500 dark:text-warm-400 text-sm leading-relaxed bg-warm-50 dark:bg-dark-raised border border-warm-200 dark:border-dark-border rounded-lg px-2 py-1.5 outline-none focus:border-trip-accent resize-none"
              ></textarea>
            </template>
            <template v-else>
              <h3 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black dark:text-warm-100 mb-3">{{ card.title }}</h3>
              <p class="text-warm-500 dark:text-warm-400 text-sm leading-relaxed">{{ card.body }}</p>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ HIGHLIGHTS (light, border-t) ════════════════════════ -->
    <section
      v-if="(editMode ? editDraft : overviewData)?.highlights?.length"
      class="-mx-4 md:-mx-6 bg-surface-page dark:bg-dark-bg border-t border-warm-200 dark:border-dark-border"
    >
      <div class="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <div v-for="(h, i) in (editMode ? editDraft : overviewData).highlights" :key="h.title" class="text-center">
            <template v-if="editMode">
              <input
                v-model="editDraft.highlights[i].emoji"
                class="text-4xl block mb-4 w-16 text-center mx-auto bg-transparent border-b border-warm-300 dark:border-dark-border focus:border-trip-accent outline-none"
              />
              <input
                v-model="editDraft.highlights[i].title"
                class="w-full font-display font-bold text-base uppercase tracking-wide text-flag-black dark:text-warm-100 bg-transparent border-b border-warm-300 dark:border-dark-border focus:border-trip-accent outline-none mb-2 text-center"
              />
              <textarea
                v-model="editDraft.highlights[i].body"
                rows="3"
                class="w-full text-warm-500 dark:text-warm-400 text-sm leading-relaxed bg-warm-50 dark:bg-dark-raised border border-warm-200 dark:border-dark-border rounded-lg px-2 py-1.5 outline-none focus:border-trip-accent resize-none text-center"
              ></textarea>
            </template>
            <template v-else>
              <span class="text-4xl block mb-4">{{ h.emoji }}</span>
              <h3 class="font-display font-bold text-base uppercase tracking-wide text-flag-black dark:text-warm-100 mb-2">{{ h.title }}</h3>
              <p class="text-warm-500 dark:text-warm-400 text-sm leading-relaxed">{{ h.body }}</p>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ CLOSING CTA (dark) ═══════════════════════════════════ -->
    <section
      v-if="(editMode ? editDraft : overviewData)?.closing"
      class="-mx-4 md:-mx-6 bg-flag-black border-t border-white/10"
    >
      <div class="max-w-3xl mx-auto px-4 sm:px-6 py-14 md:py-20 text-center">
        <textarea
          v-if="editMode"
          v-model="editDraft.closing"
          rows="2"
          class="w-full font-display font-black text-2xl md:text-3xl uppercase tracking-wide text-white mb-6 bg-white/10 border border-white/20 focus:border-white/50 rounded-lg px-3 py-2 outline-none resize-none text-center"
        ></textarea>
        <h2 v-else class="font-display font-black text-3xl md:text-4xl uppercase tracking-wide text-white mb-6">
          {{ overviewData.closing }}
        </h2>

        <!-- Admin controls -->
        <div v-if="authStore.isAdmin" class="flex items-center justify-center gap-4">
          <template v-if="editMode">
            <button
              @click="cancelEdit"
              :disabled="saving"
              class="px-5 py-2.5 rounded-lg text-sm font-medium text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              @click="saveEdit"
              :disabled="saving"
              class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-display font-bold uppercase tracking-wider bg-trip-accent hover:bg-trip-accent-hover text-white transition-colors disabled:opacity-50"
            >
              <svg v-if="saving" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ saving ? 'Saving...' : 'Save Changes' }}
            </button>
          </template>
          <template v-else>
            <button
              @click="startEdit"
              class="inline-flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Overview
            </button>
            <button
              @click="openModal"
              :disabled="generating"
              class="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors disabled:opacity-40"
            >
              <svg v-if="generating" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ generating ? 'Regenerating...' : '↻ Regenerate Overview' }}
            </button>
          </template>
        </div>
      </div>
    </section>

  </div>

  <!-- ───────────────────────────────────────────────────────────── -->
  <!-- GENERATE MODAL                                                 -->
  <!-- ───────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="cancelModal"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

        <!-- Dialog -->
        <div class="relative w-full max-w-lg bg-surface dark:bg-dark-surface rounded-2xl shadow-2xl border border-warm-200 dark:border-dark-border overflow-hidden">

          <!-- Header -->
          <div class="px-6 pt-6 pb-4 border-b border-warm-200 dark:border-dark-border">
            <h2 class="font-display font-bold text-lg uppercase tracking-wide text-flag-black dark:text-warm-100">
              {{ overviewData ? 'Regenerate Overview' : 'Generate Overview' }}
            </h2>
            <p class="text-warm-500 dark:text-warm-400 text-sm mt-1">
              Anything specific you want the AI to emphasize or include? Leave blank to generate from trip data only.
            </p>
          </div>

          <!-- Body -->
          <div class="px-6 py-5">
            <label class="block text-xs font-display font-bold uppercase tracking-wider text-warm-500 dark:text-warm-400 mb-2">
              Custom Instructions <span class="normal-case font-normal tracking-normal">(optional)</span>
            </label>
            <textarea
              ref="contextTextarea"
              v-model="customContext"
              rows="4"
              placeholder="e.g. Make it sound more epic. Emphasize the birthday angle. Focus on the offroad finale."
              class="w-full rounded-lg border border-warm-200 dark:border-dark-border bg-surface-page dark:bg-dark-raised text-warm-700 dark:text-warm-200 placeholder-warm-400 dark:placeholder-warm-600 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-trip-accent focus:border-transparent transition"
              @keydown.meta.enter="confirmGenerate"
              @keydown.ctrl.enter="confirmGenerate"
              @keydown.escape="cancelModal"
            ></textarea>
            <p class="text-xs text-warm-400 dark:text-warm-600 mt-1.5">⌘↵ to generate</p>
          </div>

          <!-- Footer -->
          <div class="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              @click="cancelModal"
              class="px-5 py-2.5 rounded-lg text-sm font-medium text-warm-600 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-dark-raised transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmGenerate"
              class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-display font-bold uppercase tracking-wider bg-trip-accent hover:bg-trip-accent-hover text-white transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              Generate
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
