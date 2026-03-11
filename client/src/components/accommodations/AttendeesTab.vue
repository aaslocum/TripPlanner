<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '../../stores/auth';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();
const members = ref([]);
const allUsers = ref([]);
const showNewUserForm = ref(false);
const newUser = ref({ first_name: '', last_name: '', email: '' });
const selectedUserId = ref('');
const showBulkImport = ref(false);
const bulkText = ref('');
const bulkParsed = ref([]);
const importing = ref(false);

async function fetchMembers() {
  if (!tripStore.selectedTripId) return;
  const { data } = await apiClient.get(`/trips/${tripStore.selectedTripId}/members`);
  members.value = data.data;
}

async function fetchAllUsers() {
  const { data } = await apiClient.get('/users');
  allUsers.value = data.data;
}

const availableUsers = computed(() => {
  const memberIds = new Set(members.value.map(m => m.user_id));
  return allUsers.value.filter(u => !memberIds.has(u.user_id));
});

async function addMember() {
  if (!selectedUserId.value) return;
  await apiClient.post(`/trips/${tripStore.selectedTripId}/members`, { user_id: Number(selectedUserId.value) });
  selectedUserId.value = '';
  await fetchMembers();
}

async function removeMember(userId) {
  if (!confirm('Are you sure you want to remove this member from the trip?')) return;
  await apiClient.delete(`/trips/${tripStore.selectedTripId}/members/${userId}`);
  await fetchMembers();
}

async function createAndAdd() {
  const { data } = await apiClient.post('/users', newUser.value);
  const createdUser = data.data;
  await apiClient.post(`/trips/${tripStore.selectedTripId}/members`, { user_id: createdUser.user_id });
  newUser.value = { first_name: '', last_name: '', email: '' };
  showNewUserForm.value = false;
  await Promise.all([fetchMembers(), fetchAllUsers()]);
}

function initials(member) {
  return (member.first_name?.[0] || '') + (member.last_name?.[0] || '');
}

function displayName(member) {
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  return name || member.email;
}

function showEmail(member) {
  // Show email only for admins, OR if the member has no name
  if (authStore.isAdmin) return true;
  const name = `${member.first_name || ''} ${member.last_name || ''}`.trim();
  return !name;
}

const confirmedCount = computed(() => members.value.filter(m => m.rsvp_status === 'yes').length);
const pendingCount = computed(() => members.value.filter(m => !m.rsvp_status || m.rsvp_status === 'pending').length);
const declinedCount = computed(() => members.value.filter(m => m.rsvp_status === 'no').length);

const visibleMembers = computed(() => {
  if (authStore.isAdmin) return members.value;
  return members.value.filter(m => m.rsvp_status === 'yes');
});

async function updateMemberRsvp(userId, newStatus) {
  if (!tripStore.selectedTripId) return;
  await apiClient.put(`/trips/${tripStore.selectedTripId}/members/${userId}`, { rsvp_status: newStatus });
  await fetchMembers();
}

function nextRsvpStatus(current) {
  const cycle = ['yes', 'pending', 'no'];
  const idx = cycle.indexOf(current || 'pending');
  return cycle[(idx + 1) % cycle.length];
}

function formatDateRange(arrival, departure) {
  const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (arrival && departure) return `${fmt(arrival)} – ${fmt(departure)}`;
  if (arrival) return `Arrives ${fmt(arrival)}`;
  if (departure) return `Departs ${fmt(departure)}`;
  return '';
}

// Parse "Name <email>" or bare email formats, comma-separated
function parseBulkInput() {
  const raw = bulkText.value.trim();
  if (!raw) { bulkParsed.value = []; return; }

  const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
  bulkParsed.value = entries.map(entry => {
    // "First Last <email>" or "First <email>" or "email"
    const angleMatch = entry.match(/^(.+?)\s*<([^>]+)>$/);
    if (angleMatch) {
      const nameParts = angleMatch[1].trim().split(/\s+/);
      return {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' '),
        email: angleMatch[2].trim(),
      };
    }
    // Bare email
    return { first_name: '', last_name: '', email: entry.trim() };
  }).filter(e => e.email);
}

async function importBulk() {
  if (!bulkParsed.value.length) return;
  importing.value = true;
  try {
    await apiClient.post(`/trips/${tripStore.selectedTripId}/members/bulk`, { entries: bulkParsed.value });
    bulkText.value = '';
    bulkParsed.value = [];
    showBulkImport.value = false;
    await Promise.all([fetchMembers(), fetchAllUsers()]);
  } finally {
    importing.value = false;
  }
}

onMounted(() => {
  fetchMembers();
  if (authStore.isAdmin) fetchAllUsers();
});
</script>

<template>
  <div>
    <!-- Current guests -->
    <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100 mb-4">Trip Guests</h3>

    <!-- RSVP summary (admin only) -->
    <div v-if="authStore.isAdmin && members.length" class="flex items-center gap-3 mb-4 text-xs font-medium">
      <span class="text-green-600 dark:text-green-400">{{ confirmedCount }} confirmed</span>
      <span class="text-warm-300 dark:text-warm-600">&middot;</span>
      <span class="text-amber-600 dark:text-amber-400">{{ pendingCount }} pending</span>
      <span v-if="declinedCount" class="text-warm-300 dark:text-warm-600">&middot;</span>
      <span v-if="declinedCount" class="text-red-500 dark:text-red-400">{{ declinedCount }} declined</span>
    </div>

    <div v-if="members.length" class="space-y-2 mb-6">
      <div
        v-for="member in visibleMembers"
        :key="member.user_id"
        class="flex items-start justify-between gap-2 bg-warm-50 dark:bg-dark-raised rounded-lg px-3 py-3 sm:px-4 sm:items-center"
      >
        <div class="flex items-start gap-3 min-w-0 sm:items-center">
          <div class="w-9 h-9 rounded-full bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent flex items-center justify-center text-sm font-semibold shrink-0">
            {{ initials(member) }}
          </div>
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-1.5">
              <p class="text-sm font-medium text-flag-black dark:text-warm-100 truncate">{{ displayName(member) }}</p>
              <span v-if="member.role === 'admin'" class="text-xs bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent px-2 py-0.5 rounded-full whitespace-nowrap">Admin</span>
              <!-- Admin: clickable RSVP badge -->
              <button
                v-if="authStore.isAdmin"
                @click.stop="updateMemberRsvp(member.user_id, nextRsvpStatus(member.rsvp_status))"
                :class="[
                  'text-xs px-2 py-0.5 rounded-full cursor-pointer hover:ring-2 hover:ring-offset-1 transition-all whitespace-nowrap',
                  member.rsvp_status === 'yes' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:ring-green-400' :
                  member.rsvp_status === 'no' ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 hover:ring-red-400' :
                  'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 hover:ring-amber-400'
                ]"
                :title="`Click to change (${member.rsvp_status || 'pending'} → ${nextRsvpStatus(member.rsvp_status)})`"
              >
                {{ member.rsvp_status === 'yes' ? 'Confirmed' : member.rsvp_status === 'no' ? 'Not attending' : 'Pending' }}
              </button>
              <!-- Non-admin: static badge -->
              <template v-else>
                <span v-if="member.rsvp_status === 'yes'" class="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full whitespace-nowrap">Confirmed</span>
                <span v-else-if="member.rsvp_status === 'no'" class="text-xs bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full whitespace-nowrap">Not attending</span>
                <span v-else class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full whitespace-nowrap">Pending</span>
              </template>
            </div>
            <p v-if="showEmail(member) && (member.first_name || member.last_name)" class="text-xs text-warm-500 dark:text-warm-400 truncate">{{ member.email }}</p>
            <p v-if="member.arrival_date || member.departure_date" class="text-xs text-warm-400 dark:text-warm-500">
              {{ formatDateRange(member.arrival_date, member.departure_date) }}
            </p>
          </div>
        </div>
        <button
          v-if="authStore.isAdmin"
          @click="removeMember(member.user_id)"
          class="text-warm-400 hover:text-red-500 transition-colors shrink-0 mt-1 sm:mt-0"
          title="Remove from trip"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-warm-500 dark:text-warm-400 mb-6">{{ authStore.isAdmin ? 'No guests yet.' : 'No confirmed guests yet.' }}</p>

    <!-- Admin-only: add guests -->
    <template v-if="authStore.isAdmin">
      <!-- Bulk import -->
      <div class="border-t border-warm-200 dark:border-dark-border pt-5">
        <button
          v-if="!showBulkImport"
          @click="showBulkImport = true"
          class="text-sm text-trip-accent hover:text-trip-accent-hover font-medium"
        >
          + Bulk Import from Email List
        </button>

        <div v-else>
          <h4 class="text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Paste Email List</h4>
          <p class="text-xs text-warm-400 mb-2">Comma-separated. Supports: Name &lt;email&gt; or just email</p>
          <textarea
            v-model="bulkText"
            @input="parseBulkInput"
            rows="3"
            class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm font-mono dark:bg-dark-raised dark:text-warm-100"
            placeholder="Nina Samuel <nina@example.com>, john@example.com, ..."
          ></textarea>

          <!-- Preview parsed entries -->
          <div v-if="bulkParsed.length" class="mt-2 mb-3">
            <p class="text-xs text-warm-500 dark:text-warm-400 mb-1">{{ bulkParsed.length }} guest{{ bulkParsed.length === 1 ? '' : 's' }} found:</p>
            <div class="max-h-40 overflow-y-auto space-y-1">
              <div v-for="(entry, idx) in bulkParsed" :key="idx" class="flex items-center gap-2 text-xs bg-warm-50 dark:bg-dark-raised rounded px-3 py-1.5">
                <span class="text-flag-black dark:text-warm-100 font-medium">{{ entry.first_name }} {{ entry.last_name }}</span>
                <span class="text-warm-400">{{ entry.email }}</span>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-2">
            <button
              @click="importBulk"
              :disabled="!bulkParsed.length || importing"
              class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg v-if="importing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
              </svg>
              {{ importing ? 'Importing...' : `Import ${bulkParsed.length} Guest${bulkParsed.length === 1 ? '' : 's'}` }}
            </button>
            <button @click="showBulkImport = false; bulkText = ''; bulkParsed = []" class="text-sm text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 px-4 py-2">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Add existing user -->
      <div class="border-t border-warm-200 dark:border-dark-border pt-5 mt-5">
        <h4 class="text-sm font-medium text-warm-700 dark:text-warm-300 mb-2">Add Existing User</h4>
        <div class="flex flex-col sm:flex-row gap-2">
          <select
            v-model="selectedUserId"
            class="w-full sm:flex-1 border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100"
          >
            <option value="" disabled>Select a user...</option>
            <option v-for="user in availableUsers" :key="user.user_id" :value="user.user_id">
              {{ user.first_name }} {{ user.last_name }} ({{ user.email }})
            </option>
          </select>
          <button
            @click="addMember"
            :disabled="!selectedUserId"
            class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50 shrink-0"
          >
            Add
          </button>
        </div>
        <p v-if="!availableUsers.length" class="text-xs text-warm-400 mt-1">All users are already guests.</p>
      </div>

      <!-- Create new user inline -->
      <div class="border-t border-warm-200 dark:border-dark-border pt-5 mt-5">
        <button
          v-if="!showNewUserForm"
          @click="showNewUserForm = true"
          class="text-sm text-trip-accent hover:text-trip-accent-hover font-medium"
        >
          + Create New Guest
        </button>

        <div v-else>
          <h4 class="text-sm font-medium text-warm-700 dark:text-warm-300 mb-2">New Guest</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-warm-500 dark:text-warm-400 mb-1">First Name</label>
              <input v-model="newUser.first_name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Jane" />
            </div>
            <div>
              <label class="block text-xs text-warm-500 dark:text-warm-400 mb-1">Last Name</label>
              <input v-model="newUser.last_name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Doe" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs text-warm-500 dark:text-warm-400 mb-1">Email</label>
              <input v-model="newUser.email" type="email" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="jane@example.com" />
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              @click="createAndAdd"
              :disabled="!newUser.first_name || !newUser.last_name || !newUser.email"
              class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50"
            >
              Create & Add
            </button>
            <button @click="showNewUserForm = false" class="text-sm text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 px-4 py-2">Cancel</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
