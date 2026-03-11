<script setup>
import { ref, computed } from 'vue';
import { useAuthStore } from '../../stores/auth';
import apiClient from '../../api/client';

const authStore = useAuthStore();
const props = defineProps({
  accommodation: { type: Object, required: true },
});
const emit = defineEmits(['refresh']);

const showForm = ref(false);
const form = ref({ name: '' });
const imageIndices = ref({});

// Price calculation: weighted share of total_cost
// Each bedroom gets weight = 10 + adjustment. Price = total * (weight / sumWeights)
const bedroomPrices = computed(() => {
  const bedrooms = props.accommodation.bedrooms || [];
  const totalCost = props.accommodation.total_cost || 0;
  if (!bedrooms.length || !totalCost) return {};
  const weights = bedrooms.map(b => 10 + (b.price_share_adjustment || 0));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const prices = {};
  bedrooms.forEach((b, i) => {
    prices[b.bedroom_id] = totalWeight > 0 ? (totalCost * weights[i] / totalWeight) : 0;
  });
  return prices;
});

const numberOfNights = computed(() => {
  const ci = props.accommodation.check_in_datetime;
  const co = props.accommodation.check_out_datetime;
  if (!ci || !co) return 0;
  return Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
});

function formatPrice(amount) {
  if (!amount && amount !== 0) return '';
  return `$${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function currentIndex(bedroom) {
  return imageIndices.value[bedroom.bedroom_id] || 0;
}

function prevImage(bedroom) {
  const total = bedroom.images?.length || 0;
  if (total <= 1) return;
  const cur = currentIndex(bedroom);
  imageIndices.value[bedroom.bedroom_id] = (cur - 1 + total) % total;
}

function nextImage(bedroom) {
  const total = bedroom.images?.length || 0;
  if (total <= 1) return;
  const cur = currentIndex(bedroom);
  imageIndices.value[bedroom.bedroom_id] = (cur + 1) % total;
}

function bedSummary(bedroom) {
  const counts = {};
  for (const bed of bedroom.beds || []) {
    const t = bed.bed_type;
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type.charAt(0).toUpperCase() + type.slice(1)} bed${count > 1 ? 's' : ''}`)
    .join(', ') || 'No beds';
}

async function updateAdjustment(bedroom, value) {
  const adj = Number(value);
  bedroom.price_share_adjustment = adj;
  await apiClient.put(`/bedrooms/${bedroom.bedroom_id}`, { price_share_adjustment: adj });
}

async function addBedroom() {
  await apiClient.post('/bedrooms', {
    accommodation_id: props.accommodation.accommodation_id,
    name: form.value.name,
  });
  form.value = { name: '' };
  showForm.value = false;
  emit('refresh');
}

async function addBed(bedroomId, bedType) {
  await apiClient.post('/beds', { bedroom_id: bedroomId, bed_type: bedType });
  emit('refresh');
}

async function deleteBedroom(id) {
  if (!confirm('Are you sure you want to remove this bedroom?')) return;
  await apiClient.delete(`/bedrooms/${id}`);
  emit('refresh');
}

// Bed requests (unified system — replaces both room claims and bed claims)
function confirmedRequests(bed) {
  return (bed.requests || []).filter(r => r.status === 'confirmed');
}
function pendingRequests(bed) {
  return (bed.requests || []).filter(r => r.status === 'requested');
}
function hasUserRequested(bed) {
  const uid = authStore.activeUser?.user_id;
  return (bed.requests || []).some(r => r.user_id === uid);
}
function userRequest(bed) {
  const uid = authStore.activeUser?.user_id;
  return (bed.requests || []).find(r => r.user_id === uid);
}
function isUserConfirmed(bed) {
  const uid = authStore.activeUser?.user_id;
  return (bed.requests || []).some(r => r.user_id === uid && r.status === 'confirmed');
}

async function requestBed(bedId) {
  try {
    await apiClient.post('/bed-requests', { bed_id: bedId });
    emit('refresh');
  } catch (err) {
    alert(err.response?.data?.error?.message || 'Failed to request bed');
  }
}

async function confirmRequest(requestId) {
  await apiClient.put(`/bed-requests/${requestId}/confirm`);
  emit('refresh');
}

async function removeRequest(requestId) {
  if (!confirm('Remove this bed request?')) return;
  await apiClient.delete(`/bed-requests/${requestId}`);
  emit('refresh');
}

const bedTypes = ['king', 'queen', 'twin', 'full', 'sofa', 'bunk'];
</script>

<template>
  <div class="max-w-full md:max-w-[900px]">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-flag-black dark:text-warm-100">Bedrooms</h3>
      <button v-if="authStore.isAdmin" @click="showForm = !showForm" class="text-sm text-trip-accent hover:text-trip-accent-hover font-medium">
        {{ showForm ? 'Cancel' : '+ Add Bedroom' }}
      </button>
    </div>

    <div v-if="showForm" class="bg-warm-50 dark:bg-dark-raised rounded-lg p-4 mb-4">
      <div class="flex gap-4 items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Room Name</label>
          <input v-model="form.name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" placeholder="Master Bedroom" />
        </div>
        <button @click="addBedroom" class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover">Add</button>
      </div>
    </div>

    <div v-if="accommodation.bedrooms?.length" class="space-y-4">
      <div
        v-for="bedroom in accommodation.bedrooms"
        :key="bedroom.bedroom_id"
        class="flex flex-col md:flex-row border border-warm-200 dark:border-dark-border rounded-xl overflow-hidden shadow-sm bg-surface dark:bg-dark-surface"
      >
        <!-- Image carousel -->
        <div class="relative w-full h-48 md:w-60 shrink-0 bg-warm-100 dark:bg-dark-raised">
          <img
            v-if="bedroom.images?.length"
            :src="bedroom.images[currentIndex(bedroom)]?.image_url"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-warm-300">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
          </div>
          <!-- Carousel arrows -->
          <template v-if="bedroom.images?.length > 1">
            <button
              @click.stop="prevImage(bedroom)"
              class="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white/70 dark:bg-dark-raised/70 hover:bg-white dark:hover:bg-dark-raised text-warm-700 dark:text-warm-200 shadow transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button
              @click.stop="nextImage(bedroom)"
              class="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-white/70 dark:bg-dark-raised/70 hover:bg-white dark:hover:bg-dark-raised text-warm-700 dark:text-warm-200 shadow transition-colors"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </template>
        </div>

        <!-- Content -->
        <div class="flex-1 p-4 md:p-5 flex flex-col">
          <div class="flex items-start justify-between">
            <h4 class="text-base font-semibold text-flag-black dark:text-warm-100">{{ bedroom.name }}</h4>
            <div class="flex items-center gap-2">
              <div v-if="bedroomPrices[bedroom.bedroom_id]" class="text-right">
                <span class="text-base font-semibold text-flag-black dark:text-warm-100">{{ formatPrice(bedroomPrices[bedroom.bedroom_id]) }}</span>
                <div v-if="numberOfNights > 0" class="text-xs text-warm-400">{{ formatPrice(bedroomPrices[bedroom.bedroom_id] / numberOfNights) }}/night</div>
              </div>
              <button v-if="authStore.isAdmin" @click="deleteBedroom(bedroom.bedroom_id)" class="text-red-400 hover:text-red-600 text-xs ml-2">Remove</button>
            </div>
          </div>

          <p class="text-sm text-warm-500 dark:text-warm-400 mt-1">{{ bedSummary(bedroom) }}</p>

          <!-- Individual beds with request status -->
          <div v-if="bedroom.beds?.length" class="mt-3 space-y-1.5">
            <div
              v-for="bed in bedroom.beds"
              :key="bed.bed_id"
              class="px-3 py-2 rounded-lg text-sm"
              :class="isUserConfirmed(bed)
                ? 'bg-trip-accent-light dark:bg-trip-accent/10 border border-trip-accent/30'
                : hasUserRequested(bed)
                  ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
                  : confirmedRequests(bed).length
                    ? 'bg-warm-50 dark:bg-dark-raised'
                    : 'bg-warm-50 dark:bg-dark-raised border border-dashed border-warm-300 dark:border-dark-border'"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-warm-700 dark:text-warm-300 capitalize">{{ bed.bed_type }} bed</span>
                  <span v-if="isUserConfirmed(bed)"
                    class="text-xs bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent px-1.5 py-0.5 rounded font-medium">
                    Your Bed
                  </span>
                  <span v-else-if="hasUserRequested(bed)"
                    class="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                    Requested
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <!-- Withdraw own pending request -->
                  <button
                    v-if="hasUserRequested(bed) && !isUserConfirmed(bed)"
                    @click="removeRequest(userRequest(bed).request_id)"
                    class="text-xs font-medium text-amber-500 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    Withdraw
                  </button>
                  <!-- Request button for unoccupied bed -->
                  <button
                    v-if="!hasUserRequested(bed)"
                    @click="requestBed(bed.bed_id)"
                    class="text-xs font-medium text-trip-accent hover:text-trip-accent-hover px-2 py-1 rounded hover:bg-trip-accent-light dark:hover:bg-trip-accent/10 transition-colors"
                  >
                    Request
                  </button>
                </div>
              </div>
              <!-- Other people's request badges -->
              <div v-if="confirmedRequests(bed).filter(r => r.user_id !== authStore.activeUser?.user_id).length || pendingRequests(bed).filter(r => r.user_id !== authStore.activeUser?.user_id).length" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="req in confirmedRequests(bed).filter(r => r.user_id !== authStore.activeUser?.user_id)"
                  :key="req.request_id"
                  class="inline-flex items-center gap-1 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded px-2 py-0.5 text-xs text-green-700 dark:text-green-300"
                >
                  {{ req.first_name }} {{ req.last_name }}
                  <button v-if="authStore.isAdmin" @click="removeRequest(req.request_id)" class="text-green-400 hover:text-red-500 ml-0.5">&times;</button>
                </span>
                <span
                  v-for="req in pendingRequests(bed).filter(r => r.user_id !== authStore.activeUser?.user_id)"
                  :key="req.request_id"
                  class="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                >
                  {{ req.first_name }} {{ req.last_name }}
                  <span class="text-amber-500">Pending</span>
                  <template v-if="authStore.isAdmin">
                    <button @click="confirmRequest(req.request_id)" class="text-green-600 hover:text-green-800 font-medium ml-0.5">Confirm</button>
                    <button @click="removeRequest(req.request_id)" class="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
                  </template>
                </span>
              </div>
            </div>
          </div>

          <div class="mt-auto pt-3 flex items-center gap-4">
            <!-- Admin: price adjustment slider -->
            <div v-if="authStore.isAdmin" class="flex items-center gap-2">
              <label class="text-xs text-warm-400 whitespace-nowrap">Price adj:</label>
              <input
                type="range"
                min="-10"
                max="10"
                step="1"
                :value="bedroom.price_share_adjustment || 0"
                @change="updateAdjustment(bedroom, $event.target.value)"
                class="w-24 h-1 accent-trip-accent"
              />
              <span class="text-xs font-mono w-6 text-center" :class="(bedroom.price_share_adjustment || 0) > 0 ? 'text-red-500' : (bedroom.price_share_adjustment || 0) < 0 ? 'text-green-600' : 'text-warm-400'">
                {{ (bedroom.price_share_adjustment || 0) > 0 ? '+' : '' }}{{ bedroom.price_share_adjustment || 0 }}
              </span>
            </div>

            <!-- Admin: add bed -->
            <div v-if="authStore.isAdmin">
              <select @change="addBed(bedroom.bedroom_id, $event.target.value); $event.target.value = ''" class="text-xs border border-warm-300 dark:border-dark-border rounded px-2 py-1 text-warm-500 dark:text-warm-400 dark:bg-dark-raised">
                <option value="">+ Add bed...</option>
                <option v-for="bt in bedTypes" :key="bt" :value="bt">{{ bt }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-warm-500 dark:text-warm-400">No bedrooms added yet.</p>
  </div>
</template>
