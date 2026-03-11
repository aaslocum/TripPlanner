<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import { useAgentStore } from '../stores/agent';
import apiClient from '../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();

const rows = ref([]);
const members = ref([]);
const loading = ref(false);
const error = ref('');

// ---- Form state ----
const showForm = ref(false);
const editingId = ref(null);
const formData = ref({
  user_id: '',
  mode: 'flying',
  departure_from: '',
  arrival_datetime: '',
  return_datetime: '',
  flight_number: '',
  car_capacity: '',
  notes: '',
});
const formSaving = ref(false);
const formError = ref('');

const modeOptions = [
  { value: 'flying',   label: '✈️ Flying' },
  { value: 'driving',  label: '🚗 Driving' },
  { value: 'train',    label: '🚂 Train' },
  { value: 'rideshare', label: '🚕 Rideshare' },
  { value: 'other',    label: '🚌 Other' },
];

// Current user's existing transport entry
const myEntry = computed(() =>
  rows.value.find(r => r.user_id === authStore.activeUser?.user_id)
);

// Only confirmed attendees are relevant for logistics
const confirmedMembers = computed(() => members.value.filter(m => m.rsvp_status === 'yes'));

// Members who don't yet have a transport entry (for the Add form user dropdown — admin only)
const membersWithoutTransport = computed(() => {
  const assignedIds = new Set(rows.value.map(r => r.user_id));
  return confirmedMembers.value.filter(m => !assignedIds.has(m.user_id));
});

// Can the current user add an entry? Admin: anyone unassigned. User: only if they don't have one yet
const canAdd = computed(() => {
  if (authStore.isAdmin) return membersWithoutTransport.value.length > 0;
  return !myEntry.value;
});

// Can the current user edit/delete a given row?
function canModify(row) {
  return authStore.isAdmin || row.user_id === authStore.activeUser?.user_id;
}

// Carpool summary
const drivers = computed(() =>
  rows.value.filter(r => r.mode === 'driving').map(r => ({
    ...r,
    availableSeats: r.car_capacity ? r.car_capacity - 1 : 0,
  }))
);

async function fetchData() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  error.value = '';
  try {
    const [transRes, membersRes] = await Promise.all([
      apiClient.get(`/trips/${tripStore.selectedTripId}/transportation`),
      apiClient.get(`/trips/${tripStore.selectedTripId}/members`),
    ]);
    rows.value = transRes.data.data;
    members.value = membersRes.data.data;
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Failed to load data';
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  editingId.value = null;
  formData.value = {
    user_id: authStore.isAdmin ? '' : String(authStore.activeUser?.user_id || ''),
    mode: 'flying',
    departure_from: '',
    arrival_datetime: '',
    return_datetime: '',
    flight_number: '',
    car_capacity: '',
    notes: '',
  };
  formError.value = '';
  showForm.value = true;
}

function openEdit(row) {
  editingId.value = row.transport_id;
  formData.value = {
    user_id: row.user_id,
    mode: row.mode,
    departure_from: row.departure_from || '',
    arrival_datetime: row.arrival_datetime ? row.arrival_datetime.slice(0, 16) : '',
    return_datetime: row.return_datetime ? row.return_datetime.slice(0, 16) : '',
    flight_number: row.flight_number || '',
    car_capacity: row.car_capacity != null ? String(row.car_capacity) : '',
    notes: row.notes || '',
  };
  formError.value = '';
  showForm.value = true;
}

async function saveForm() {
  const effectiveUserId = authStore.isAdmin ? formData.value.user_id : authStore.activeUser?.user_id;
  if (!effectiveUserId || !formData.value.mode) {
    formError.value = 'Transport mode is required.';
    return;
  }
  formSaving.value = true;
  formError.value = '';
  const payload = {
    ...formData.value,
    user_id: effectiveUserId,
    car_capacity: formData.value.car_capacity ? parseInt(formData.value.car_capacity) : null,
    arrival_datetime: formData.value.arrival_datetime || null,
    return_datetime: formData.value.return_datetime || null,
    departure_from: formData.value.departure_from || null,
    flight_number: formData.value.flight_number || null,
    notes: formData.value.notes || null,
  };
  try {
    if (editingId.value) {
      const { data } = await apiClient.put(
        `/trips/${tripStore.selectedTripId}/transportation/${editingId.value}`, payload
      );
      const idx = rows.value.findIndex(r => r.transport_id === editingId.value);
      if (idx !== -1) rows.value[idx] = data.data;
    } else {
      const { data } = await apiClient.post(
        `/trips/${tripStore.selectedTripId}/transportation`, payload
      );
      rows.value.push(data.data);
      rows.value.sort((a, b) => (a.arrival_datetime || '').localeCompare(b.arrival_datetime || ''));
    }
    showForm.value = false;
  } catch (err) {
    formError.value = err.response?.data?.error?.message || 'Save failed';
  } finally {
    formSaving.value = false;
  }
}

async function deleteRow(transportId) {
  if (!confirm('Remove this transport entry?')) return;
  error.value = '';
  try {
    await apiClient.delete(`/trips/${tripStore.selectedTripId}/transportation/${transportId}`);
    rows.value = rows.value.filter(r => r.transport_id !== transportId);
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Delete failed';
  }
}

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function modeEmoji(mode) {
  return modeOptions.find(m => m.value === mode)?.label ?? mode;
}

onMounted(() => fetchData());

// Agent action handler — add-logistics / edit-logistics
const agentStore = useAgentStore();

watch(() => agentStore.pendingAction, (action) => {
  if (!action) return;

  if (action.type === 'add-logistics') {
    agentStore.clearAction();
    openAdd();
    const fd = action.formData || {};
    if (fd.mode) formData.value.mode = fd.mode;
    if (fd.departure_from) formData.value.departure_from = fd.departure_from;
    if (fd.arrival_datetime) formData.value.arrival_datetime = fd.arrival_datetime;
    if (fd.return_datetime) formData.value.return_datetime = fd.return_datetime;
    if (fd.flight_number) formData.value.flight_number = fd.flight_number;
    if (fd.car_capacity != null) formData.value.car_capacity = String(fd.car_capacity);
    if (fd.notes) formData.value.notes = fd.notes;
    // If agent specified a userId (admin only), pre-select the person
    if (action.userId && authStore.isAdmin) formData.value.user_id = String(action.userId);
    agentStore.setResult({ success: true, message: 'Transport form pre-filled — review and save.' });
    return;
  }

  if (action.type === 'edit-logistics') {
    agentStore.clearAction();
    const existing = rows.value.find(r => r.transport_id === action.transportId);
    if (!existing) {
      agentStore.setResult({ success: false, message: `Transport entry #${action.transportId} not found.` });
      return;
    }
    openEdit(existing);
    const fd = action.formData || {};
    if (fd.mode) formData.value.mode = fd.mode;
    if (fd.departure_from) formData.value.departure_from = fd.departure_from;
    if (fd.arrival_datetime) formData.value.arrival_datetime = fd.arrival_datetime;
    if (fd.return_datetime) formData.value.return_datetime = fd.return_datetime;
    if (fd.flight_number) formData.value.flight_number = fd.flight_number;
    if (fd.car_capacity != null) formData.value.car_capacity = String(fd.car_capacity);
    if (fd.notes) formData.value.notes = fd.notes;
    agentStore.setResult({ success: true, message: 'Edit form loaded with changes — review and save when ready.' });
    return;
  }
});
</script>

<template>
  <div class="max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Logistics</h2>
        <p class="text-sm text-warm-500 dark:text-warm-400 mt-0.5">Track how everyone is getting to the trip</p>
      </div>
      <button
        v-if="canAdd"
        @click="openAdd"
        class="flex items-center gap-2 bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        {{ authStore.isAdmin ? 'Add Entry' : 'Add My Transport' }}
      </button>
    </div>

    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">{{ error }}</div>

    <div v-if="loading" class="py-16 text-center text-warm-400 dark:text-warm-500">Loading...</div>

    <div v-else class="space-y-5">

      <!-- Carpool summary -->
      <div v-if="drivers.length > 0 || membersWithoutTransport.length > 0"
           class="bg-surface dark:bg-dark-surface border border-warm-200 dark:border-dark-border rounded-xl p-4">
        <p class="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wide mb-3">Carpool Status</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p class="text-xs font-medium text-warm-400 dark:text-warm-500 mb-2">Drivers with open seats</p>
            <div v-if="drivers.length === 0" class="text-xs text-warm-400 italic">No drivers yet</div>
            <div v-for="d in drivers" :key="d.transport_id" class="flex items-center gap-2 py-1">
              <svg class="w-4 h-4 text-warm-500 dark:text-warm-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 16l1-2h6l2-3h4l4 2 2 1 1 2H1z"/>
                <circle cx="7" cy="18" r="2" stroke-width="2"/>
                <circle cx="17" cy="18" r="2" stroke-width="2"/>
              </svg>
              <span class="text-sm text-flag-black dark:text-warm-200">{{ d.first_name }} {{ d.last_name }}</span>
              <span class="text-xs text-warm-400 dark:text-warm-500">
                — {{ d.availableSeats > 0 ? `${d.availableSeats} seat${d.availableSeats !== 1 ? 's' : ''} open` : 'full' }}
              </span>
            </div>
          </div>
          <div v-if="membersWithoutTransport.length > 0">
            <p class="text-xs font-medium text-warm-400 dark:text-warm-500 mb-2">No plan yet</p>
            <div v-for="m in membersWithoutTransport" :key="m.user_id" class="flex items-center gap-2 py-1">
              <span class="w-1.5 h-1.5 rounded-full bg-warm-300 dark:bg-warm-600 shrink-0"></span>
              <span class="text-sm text-warm-600 dark:text-warm-400">{{ m.first_name }} {{ m.last_name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="rows.length === 0"
           class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-12 text-center">
        <svg class="w-12 h-12 mx-auto text-warm-400 dark:text-warm-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        <p class="text-sm text-warm-500 dark:text-warm-400">No transport entries yet</p>
        <p class="text-xs text-warm-400 dark:text-warm-500 mt-1">Click the button above to add how you're getting to the trip</p>
      </div>

      <!-- Transport cards -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="row in rows"
          :key="row.transport_id"
          class="bg-surface dark:bg-dark-surface rounded-xl border border-warm-200 dark:border-dark-border p-4 transition-colors"
          :class="row.user_id === authStore.activeUser?.user_id ? 'border-trip-accent/40 dark:border-trip-accent/30 bg-trip-accent-light/20 dark:bg-trip-accent/5' : ''"
        >
          <!-- Card header: mode + name + actions -->
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-trip-accent-light/50 dark:bg-trip-accent/10 flex items-center justify-center text-trip-accent shrink-0">
                <svg v-if="row.mode === 'flying'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
                </svg>
                <svg v-else-if="row.mode === 'driving'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 16l1-2h6l2-3h4l4 2 2 1 1 2H1z"/>
                  <circle cx="7" cy="18" r="2" stroke-width="2"/>
                  <circle cx="17" cy="18" r="2" stroke-width="2"/>
                </svg>
                <svg v-else-if="row.mode === 'train'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3h6M8 7h8a2 2 0 012 2v7a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2zm3 11l-2 3m6-3l2 3M9 12h.01M15 12h.01"/>
                </svg>
                <svg v-else-if="row.mode === 'rideshare'" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                </svg>
              </div>
              <div>
                <p class="font-semibold text-flag-black dark:text-warm-100 leading-tight">
                  {{ row.first_name }} {{ row.last_name }}
                  <span v-if="row.user_id === authStore.activeUser?.user_id" class="text-xs font-normal text-trip-accent ml-1">(you)</span>
                </p>
                <p class="text-xs text-warm-400 dark:text-warm-500 capitalize mt-0.5">{{ row.mode }}</p>
              </div>
            </div>
            <div v-if="canModify(row)" class="flex items-center gap-1 shrink-0 -mr-1">
              <button
                @click="openEdit(row)"
                class="p-1.5 rounded text-warm-400 hover:text-trip-accent hover:bg-trip-accent-light dark:hover:bg-trip-accent/10 transition-colors"
                title="Edit"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
              <button
                @click="deleteRow(row.transport_id)"
                class="p-1.5 rounded text-warm-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                title="Delete"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Trip details -->
          <div class="space-y-1.5 text-sm border-t border-warm-100 dark:border-dark-border pt-3">
            <div v-if="row.departure_from" class="flex items-center gap-3">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0">From</span>
              <span class="text-warm-700 dark:text-warm-300">{{ row.departure_from }}</span>
            </div>
            <div v-if="row.arrival_datetime" class="flex items-center gap-3">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0">Arrives</span>
              <span class="text-warm-700 dark:text-warm-300">{{ fmt(row.arrival_datetime) }}</span>
            </div>
            <div v-if="row.return_datetime" class="flex items-center gap-3">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0">Departs</span>
              <span class="text-warm-700 dark:text-warm-300">{{ fmt(row.return_datetime) }}</span>
            </div>
            <div v-if="row.mode === 'flying' && row.flight_number" class="flex items-center gap-3">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0">Flight</span>
              <span class="text-warm-700 dark:text-warm-300">{{ row.flight_number }}</span>
            </div>
            <div v-if="row.mode === 'driving' && row.car_capacity" class="flex items-center gap-3">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0">Capacity</span>
              <span class="text-warm-700 dark:text-warm-300">{{ row.car_capacity }} seats total</span>
            </div>
            <div v-if="row.notes" class="flex items-start gap-3 pt-1.5 mt-1 border-t border-warm-100 dark:border-dark-border">
              <span class="text-xs text-warm-400 dark:text-warm-500 w-14 shrink-0 pt-0.5">Note</span>
              <span class="text-xs text-warm-500 dark:text-warm-400">{{ row.notes }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showForm" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/40 dark:bg-black/60" @click="showForm = false"></div>
          <!-- Panel -->
          <div class="relative w-full max-w-lg bg-surface dark:bg-dark-surface rounded-xl shadow-xl overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-warm-200 dark:border-dark-border">
              <h3 class="font-semibold text-flag-black dark:text-warm-100">{{ editingId ? 'Edit Transport' : authStore.isAdmin ? 'Add Transport Entry' : 'Add My Transport' }}</h3>
              <button @click="showForm = false" class="p-1 rounded text-warm-400 hover:text-warm-700 dark:hover:text-warm-300">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="p-5 space-y-4">
              <div v-if="formError" class="p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">{{ formError }}</div>

              <!-- Person (admin only when adding) -->
              <div v-if="authStore.isAdmin && !editingId">
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Person <span class="text-red-500">*</span></label>
                <select
                  v-model="formData.user_id"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                >
                  <option value="">Select person...</option>
                  <option v-for="m in membersWithoutTransport" :key="m.user_id" :value="m.user_id">
                    {{ m.first_name }} {{ m.last_name }}
                  </option>
                </select>
              </div>
              <div v-else-if="editingId">
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Person</label>
                <p class="text-sm text-flag-black dark:text-warm-100 px-3 py-2 bg-surface-page dark:bg-dark-raised rounded-lg border border-warm-200 dark:border-dark-border">
                  {{ rows.find(r => r.transport_id === editingId)?.first_name }} {{ rows.find(r => r.transport_id === editingId)?.last_name }}
                </p>
              </div>

              <!-- Mode -->
              <div>
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Transport Mode <span class="text-red-500">*</span></label>
                <select
                  v-model="formData.mode"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                >
                  <option v-for="opt in modeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>

              <!-- Departure from + dates -->
              <div class="grid grid-cols-2 gap-3">
                <div class="col-span-2">
                  <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Departing From</label>
                  <input
                    v-model="formData.departure_from"
                    type="text"
                    placeholder="e.g. Charlotte, NC"
                    class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Arrival</label>
                  <input
                    v-model="formData.arrival_datetime"
                    type="datetime-local"
                    class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                  />
                </div>
                <div>
                  <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Departure Home</label>
                  <input
                    v-model="formData.return_datetime"
                    type="datetime-local"
                    class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                  />
                </div>
              </div>

              <!-- Flight number (flying only) -->
              <div v-if="formData.mode === 'flying'">
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Flight Number</label>
                <input
                  v-model="formData.flight_number"
                  type="text"
                  placeholder="e.g. AA1234"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>

              <!-- Car capacity (driving only) -->
              <div v-if="formData.mode === 'driving'">
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Total Car Seats (including driver)</label>
                <input
                  v-model="formData.car_capacity"
                  type="number"
                  min="1"
                  max="15"
                  placeholder="e.g. 5"
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>

              <!-- Notes -->
              <div>
                <label class="block text-xs font-medium text-warm-700 dark:text-warm-300 mb-1.5">Notes</label>
                <input
                  v-model="formData.notes"
                  type="text"
                  placeholder="Any additional info..."
                  class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100 focus:outline-none focus:ring-2 focus:ring-trip-accent"
                />
              </div>
            </div>

            <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-warm-200 dark:border-dark-border bg-surface-page dark:bg-dark-raised">
              <button
                @click="showForm = false"
                class="px-4 py-2 text-sm text-warm-700 dark:text-warm-300 hover:text-flag-black dark:hover:text-warm-100 transition-colors"
              >
                Cancel
              </button>
              <button
                @click="saveForm"
                :disabled="formSaving"
                class="flex items-center gap-2 bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors disabled:opacity-50"
              >
                <svg v-if="formSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {{ formSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Entry' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: translateY(20px);
}
</style>
