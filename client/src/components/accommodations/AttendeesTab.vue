<script setup>
import { ref, computed, onMounted } from 'vue';
import { useTripStore } from '../../stores/trip';
import apiClient from '../../api/client';

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
  fetchAllUsers();
});
</script>

<template>
  <div>
    <!-- Current attendees -->
    <h3 class="text-lg font-semibold text-gray-900 mb-4">Trip Attendees</h3>

    <div v-if="members.length" class="space-y-2 mb-6">
      <div
        v-for="member in members"
        :key="member.user_id"
        class="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold">
            {{ initials(member) }}
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900">{{ member.first_name }} {{ member.last_name }}</p>
            <p class="text-xs text-gray-500">{{ member.email }}</p>
          </div>
          <span v-if="member.role === 'admin'" class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <button
          @click="removeMember(member.user_id)"
          class="text-gray-400 hover:text-red-500 transition-colors"
          title="Remove from trip"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
    <p v-else class="text-sm text-gray-500 mb-6">No attendees yet.</p>

    <!-- Bulk import -->
    <div class="border-t border-gray-200 pt-5">
      <button
        v-if="!showBulkImport"
        @click="showBulkImport = true"
        class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        + Bulk Import from Email List
      </button>

      <div v-else>
        <h4 class="text-sm font-medium text-gray-700 mb-1">Paste Email List</h4>
        <p class="text-xs text-gray-400 mb-2">Comma-separated. Supports: Name &lt;email&gt; or just email</p>
        <textarea
          v-model="bulkText"
          @input="parseBulkInput"
          rows="3"
          class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
          placeholder="Nina Samuel <nina@example.com>, john@example.com, ..."
        ></textarea>

        <!-- Preview parsed entries -->
        <div v-if="bulkParsed.length" class="mt-2 mb-3">
          <p class="text-xs text-gray-500 mb-1">{{ bulkParsed.length }} attendee{{ bulkParsed.length === 1 ? '' : 's' }} found:</p>
          <div class="max-h-40 overflow-y-auto space-y-1">
            <div v-for="(entry, idx) in bulkParsed" :key="idx" class="flex items-center gap-2 text-xs bg-gray-50 rounded px-3 py-1.5">
              <span class="text-gray-900 font-medium">{{ entry.first_name }} {{ entry.last_name }}</span>
              <span class="text-gray-400">{{ entry.email }}</span>
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-2">
          <button
            @click="importBulk"
            :disabled="!bulkParsed.length || importing"
            class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg v-if="importing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            {{ importing ? 'Importing...' : `Import ${bulkParsed.length} Attendee${bulkParsed.length === 1 ? '' : 's'}` }}
          </button>
          <button @click="showBulkImport = false; bulkText = ''; bulkParsed = []" class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Add existing user -->
    <div class="border-t border-gray-200 pt-5 mt-5">
      <h4 class="text-sm font-medium text-gray-700 mb-2">Add Existing User</h4>
      <div class="flex gap-2">
        <select
          v-model="selectedUserId"
          class="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="" disabled>Select a user...</option>
          <option v-for="user in availableUsers" :key="user.user_id" :value="user.user_id">
            {{ user.first_name }} {{ user.last_name }} ({{ user.email }})
          </option>
        </select>
        <button
          @click="addMember"
          :disabled="!selectedUserId"
          class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <p v-if="!availableUsers.length" class="text-xs text-gray-400 mt-1">All users are already attendees.</p>
    </div>

    <!-- Create new user inline -->
    <div class="border-t border-gray-200 pt-5 mt-5">
      <button
        v-if="!showNewUserForm"
        @click="showNewUserForm = true"
        class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
      >
        + Create New Attendee
      </button>

      <div v-else>
        <h4 class="text-sm font-medium text-gray-700 mb-2">New Attendee</h4>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-gray-500 mb-1">First Name</label>
            <input v-model="newUser.first_name" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Jane" />
          </div>
          <div>
            <label class="block text-xs text-gray-500 mb-1">Last Name</label>
            <input v-model="newUser.last_name" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Doe" />
          </div>
          <div class="col-span-2">
            <label class="block text-xs text-gray-500 mb-1">Email</label>
            <input v-model="newUser.email" type="email" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="jane@example.com" />
          </div>
        </div>
        <div class="flex gap-2 mt-3">
          <button
            @click="createAndAdd"
            :disabled="!newUser.first_name || !newUser.last_name || !newUser.email"
            class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Create & Add
          </button>
          <button @click="showNewUserForm = false" class="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>
