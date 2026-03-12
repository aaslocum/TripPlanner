<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useTripStore } from '../stores/trip';
import apiClient from '../api/client';

const authStore = useAuthStore();
const tripStore = useTripStore();

const items = ref([]);
const members = ref([]);
const loading = ref(false);
const error = ref('');

// Form state
const showForm = ref(false);
const editingId = ref(null);
const formData = ref({ description: '', notes: '', quantity: 1, image_url: '', claim_all: false });
const formSaving = ref(false);
const formError = ref('');

// Current user RSVP status
const myRsvp = computed(() => {
  const me = members.value.find(m => m.user_id === authStore.activeUser?.user_id);
  return me?.rsvp_status;
});
const canClaim = computed(() => myRsvp.value === 'yes' || authStore.isAdmin);

// Stats
const fulfilledCount = computed(() => items.value.filter(i => i.remaining <= 0).length);
const unresolvedCount = computed(() => items.value.filter(i => i.remaining > 0).length);

async function fetchData() {
  if (!tripStore.selectedTripId) return;
  loading.value = true;
  error.value = '';
  try {
    const [gearRes, membersRes] = await Promise.all([
      apiClient.get(`/gear/trip/${tripStore.selectedTripId}`),
      apiClient.get(`/trips/${tripStore.selectedTripId}/members`),
    ]);
    items.value = gearRes.data.data;
    members.value = membersRes.data.data;
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Failed to load gear list';
  } finally {
    loading.value = false;
  }
}

function openAddForm() {
  editingId.value = null;
  formData.value = { description: '', notes: '', quantity: 1, image_url: '', claim_all: false };
  formError.value = '';
  showForm.value = true;
}

function openEditForm(item) {
  editingId.value = item.item_id;
  formData.value = {
    description: item.description,
    notes: item.notes || '',
    quantity: item.quantity,
    image_url: item.image_url || '',
    claim_all: false,
  };
  formError.value = '';
  showForm.value = true;
}

async function saveItem() {
  formSaving.value = true;
  formError.value = '';
  try {
    if (editingId.value) {
      await apiClient.put(`/gear/${editingId.value}`, formData.value);
    } else {
      await apiClient.post('/gear', {
        trip_id: tripStore.selectedTripId,
        ...formData.value,
      });
    }
    showForm.value = false;
    await fetchData();
  } catch (err) {
    formError.value = err.response?.data?.error?.message || 'Failed to save';
  } finally {
    formSaving.value = false;
  }
}

async function deleteItem(item) {
  if (!confirm(`Remove "${item.description}" from the gear list?`)) return;
  try {
    await apiClient.delete(`/gear/${item.item_id}`);
    await fetchData();
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Failed to delete';
  }
}

async function claimItem(item) {
  const qty = item._claimQty || 1;
  try {
    await apiClient.post(`/gear/${item.item_id}/claims`, { quantity: qty });
    await fetchData();
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Failed to claim';
  }
}

async function removeClaim(claim) {
  try {
    await apiClient.delete(`/gear/claims/${claim.claim_id}`);
    await fetchData();
  } catch (err) {
    error.value = err.response?.data?.error?.message || 'Failed to remove claim';
  }
}

function canEditItem(item) {
  return authStore.isAdmin || item.created_by === authStore.activeUser?.user_id;
}

function canRemoveClaim(claim) {
  return authStore.isAdmin || claim.user_id === authStore.activeUser?.user_id;
}

function myClaim(item) {
  return item.claims?.find(c => c.user_id === authStore.activeUser?.user_id);
}

watch(() => tripStore.selectedTripId, fetchData);
onMounted(fetchData);
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-display font-black uppercase text-flag-black dark:text-warm-100">Gear</h2>
      <button @click="openAddForm" class="bg-trip-accent hover:bg-trip-accent-hover text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
        + Add Item
      </button>
    </div>

    <!-- Summary bar -->
    <div v-if="items.length" class="flex gap-4 mb-6 text-sm">
      <span class="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
        {{ fulfilledCount }} covered
      </span>
      <span v-if="unresolvedCount" class="px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
        {{ unresolvedCount }} need volunteers
      </span>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm" class="bg-surface dark:bg-dark-surface border border-warm-200 dark:border-dark-border rounded-xl p-6 mb-6">
      <h3 class="text-lg font-display font-bold text-flag-black dark:text-warm-100 mb-4">
        {{ editingId ? 'Edit Item' : 'Add Gear Item' }}
      </h3>

      <div v-if="formError" class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
        {{ formError }}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Description *</label>
          <input v-model="formData.description" type="text" placeholder="e.g. Large cooler, Bluetooth speaker..."
            class="w-full px-3 py-2 rounded-lg border border-warm-300 dark:border-dark-border bg-white dark:bg-dark-raised text-flag-black dark:text-warm-100 text-sm focus:outline-none focus:ring-2 focus:ring-trip-accent" />
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Notes</label>
          <textarea v-model="formData.notes" rows="2" placeholder="Any details — size, brand preference, etc."
            class="w-full px-3 py-2 rounded-lg border border-warm-300 dark:border-dark-border bg-white dark:bg-dark-raised text-flag-black dark:text-warm-100 text-sm focus:outline-none focus:ring-2 focus:ring-trip-accent"></textarea>
        </div>
        <div>
          <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Quantity needed</label>
          <input v-model.number="formData.quantity" type="number" min="1"
            class="w-full px-3 py-2 rounded-lg border border-warm-300 dark:border-dark-border bg-white dark:bg-dark-raised text-flag-black dark:text-warm-100 text-sm focus:outline-none focus:ring-2 focus:ring-trip-accent" />
        </div>
        <div>
          <label class="block text-xs font-medium text-warm-500 dark:text-warm-400 mb-1">Image URL</label>
          <input v-model="formData.image_url" type="text" placeholder="https://..."
            class="w-full px-3 py-2 rounded-lg border border-warm-300 dark:border-dark-border bg-white dark:bg-dark-raised text-flag-black dark:text-warm-100 text-sm focus:outline-none focus:ring-2 focus:ring-trip-accent" />
        </div>
      </div>

      <!-- Claim all checkbox (only on create, if user can claim) -->
      <div v-if="!editingId && canClaim" class="mt-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input v-model="formData.claim_all" type="checkbox"
            class="w-4 h-4 rounded border-warm-300 text-trip-accent focus:ring-trip-accent" />
          <span class="text-sm text-warm-700 dark:text-warm-300">I'll bring all of these</span>
        </label>
      </div>

      <div class="flex gap-3 mt-5">
        <button @click="saveItem" :disabled="formSaving || !formData.description.trim()"
          class="bg-trip-accent hover:bg-trip-accent-hover text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {{ formSaving ? 'Saving...' : (editingId ? 'Update' : 'Add Item') }}
        </button>
        <button @click="showForm = false" class="px-5 py-2 rounded-lg text-sm font-medium text-warm-600 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-dark-raised transition-colors">
          Cancel
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-warm-500 dark:text-warm-400">Loading gear list...</div>

    <!-- Empty state -->
    <div v-else-if="!items.length" class="text-center py-12">
      <p class="text-warm-500 dark:text-warm-400 mb-2">No gear items yet</p>
      <p class="text-sm text-warm-400 dark:text-warm-500">Add items the group needs to bring for the trip.</p>
    </div>

    <!-- Item cards -->
    <div v-else class="space-y-4">
      <div v-for="item in items" :key="item.item_id"
        class="bg-surface dark:bg-dark-surface border border-warm-200 dark:border-dark-border rounded-xl overflow-hidden">
        <div class="p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <!-- Description + creator -->
              <h3 class="text-base font-semibold text-flag-black dark:text-warm-100">{{ item.description }}</h3>
              <p v-if="item.creator_first_name" class="text-xs text-warm-400 dark:text-warm-500 mt-0.5">
                Added by {{ item.creator_first_name }} {{ item.creator_last_name }}
              </p>
            </div>

            <!-- Image thumbnail -->
            <img v-if="item.image_url" :src="item.image_url" class="w-16 h-16 rounded-lg object-cover flex-shrink-0" />

            <!-- Edit/Delete (admin or creator) -->
            <div v-if="canEditItem(item)" class="flex gap-1 flex-shrink-0">
              <button @click="openEditForm(item)" class="p-1.5 rounded text-warm-400 hover:text-trip-accent hover:bg-warm-100 dark:hover:bg-dark-raised transition-colors" title="Edit">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button @click="deleteItem(item)" class="p-1.5 rounded text-warm-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors" title="Delete">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Notes -->
          <p v-if="item.notes" class="text-sm text-warm-600 dark:text-warm-400 mt-2">{{ item.notes }}</p>

          <!-- Progress bar -->
          <div class="mt-4">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-medium" :class="item.remaining <= 0 ? 'text-green-600 dark:text-green-400' : 'text-warm-500 dark:text-warm-400'">
                {{ item.total_claimed }}/{{ item.quantity }} claimed
              </span>
              <span v-if="item.remaining > 0" class="text-xs text-yellow-600 dark:text-yellow-400">
                {{ item.remaining }} still needed
              </span>
              <span v-else class="text-xs text-green-600 dark:text-green-400">Covered</span>
            </div>
            <div class="w-full bg-warm-200 dark:bg-dark-border rounded-full h-2">
              <div class="h-2 rounded-full transition-all duration-300"
                :class="item.remaining <= 0 ? 'bg-green-500' : item.total_claimed > 0 ? 'bg-yellow-500' : 'bg-warm-300 dark:bg-warm-600'"
                :style="{ width: Math.min(100, (item.total_claimed / item.quantity) * 100) + '%' }">
              </div>
            </div>
          </div>

          <!-- Claims list -->
          <div v-if="item.claims.length" class="mt-3 space-y-1">
            <div v-for="claim in item.claims" :key="claim.claim_id"
              class="flex items-center justify-between text-sm py-1 px-2 rounded bg-warm-50 dark:bg-dark-raised">
              <span class="text-warm-700 dark:text-warm-300">
                {{ claim.first_name }} {{ claim.last_name }}
                <span class="text-warm-400 dark:text-warm-500">bringing {{ claim.quantity }}</span>
              </span>
              <button v-if="canRemoveClaim(claim)" @click="removeClaim(claim)"
                class="text-warm-400 hover:text-red-500 transition-colors p-0.5" title="Remove claim">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Claim section (if remaining and user can claim and hasn't already) -->
          <div v-if="item.remaining > 0 && canClaim && !myClaim(item)" class="mt-3 flex items-center gap-2">
            <input v-model.number="item._claimQty" type="number" min="1" :max="item.remaining"
              :placeholder="'1'"
              class="w-16 px-2 py-1.5 rounded-lg border border-warm-300 dark:border-dark-border bg-white dark:bg-dark-raised text-flag-black dark:text-warm-100 text-sm focus:outline-none focus:ring-2 focus:ring-trip-accent" />
            <button @click="claimItem(item)"
              class="bg-trip-accent hover:bg-trip-accent-hover text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
              I'll bring {{ item._claimQty > 1 ? 'these' : 'it' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
