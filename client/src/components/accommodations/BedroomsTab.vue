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

// Room claiming
function confirmedClaims(bedroom) {
  return (bedroom.claims || []).filter(c => c.status === 'confirmed');
}
function pendingClaims(bedroom) {
  return (bedroom.claims || []).filter(c => c.status === 'requested');
}
function hasUserClaimed(bedroom) {
  const uid = authStore.activeUser?.user_id;
  return (bedroom.claims || []).some(c => c.user_id === uid);
}

async function requestRoom(bedroomId) {
  await apiClient.post('/bedroom-claims', {
    bedroom_id: bedroomId,
    user_id: authStore.activeUser.user_id,
  });
  emit('refresh');
}

async function confirmClaim(claimId) {
  await apiClient.put(`/bedroom-claims/${claimId}/confirm`);
  emit('refresh');
}

async function removeClaim(claimId) {
  if (!confirm('Are you sure you want to remove this room claim?')) return;
  await apiClient.delete(`/bedroom-claims/${claimId}`);
  emit('refresh');
}

async function claimBed(bedId) {
  try {
    await apiClient.post(`/beds/${bedId}/claim`);
    emit('refresh');
  } catch (err) {
    alert(err.response?.data?.error?.message || 'Failed to claim bed');
  }
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

          <!-- Individual beds with claim buttons -->
          <div v-if="bedroom.beds?.length" class="mt-3 space-y-1.5">
            <div
              v-for="bed in bedroom.beds"
              :key="bed.bed_id"
              class="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
              :class="bed.assigned_user_id === authStore.activeUser?.user_id
                ? 'bg-trip-accent-light dark:bg-trip-accent/10 border border-trip-accent/30 dark:border-trip-accent/30'
                : bed.assigned_user_id
                  ? 'bg-warm-50 dark:bg-dark-raised'
                  : 'bg-warm-50 dark:bg-dark-raised border border-dashed border-warm-300 dark:border-dark-border'"
            >
              <div class="flex items-center gap-2">
                <span class="font-medium text-warm-700 dark:text-warm-300 capitalize">{{ bed.bed_type }} bed</span>
                <span v-if="bed.assigned_user_id === authStore.activeUser?.user_id"
                  class="text-xs bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent px-1.5 py-0.5 rounded font-medium">
                  Your Bed
                </span>
                <span v-else-if="bed.first_name"
                  class="text-xs text-warm-500 dark:text-warm-400">
                  {{ bed.first_name }} {{ bed.last_name }}
                </span>
              </div>
              <button
                v-if="!bed.assigned_user_id"
                @click="claimBed(bed.bed_id)"
                class="text-xs font-medium text-trip-accent hover:text-trip-accent-hover px-2 py-1 rounded hover:bg-trip-accent-light dark:hover:bg-trip-accent/10 transition-colors"
              >
                Claim
              </button>
            </div>
          </div>

          <!-- Room claims -->
          <div class="flex flex-wrap gap-2 mt-3">
            <!-- Confirmed occupants -->
            <span
              v-for="claim in confirmedClaims(bedroom)"
              :key="claim.claim_id"
              class="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md px-2.5 py-1 text-sm text-green-800 dark:text-green-300"
            >
              {{ claim.first_name }} {{ claim.last_name }}
              <span class="text-xs text-green-500">Confirmed</span>
              <button v-if="authStore.isAdmin" @click="removeClaim(claim.claim_id)" class="text-green-400 hover:text-red-500 ml-1">&times;</button>
            </span>
            <!-- Pending requests (admin sees all, user sees own) -->
            <span
              v-for="claim in pendingClaims(bedroom)"
              :key="claim.claim_id"
              class="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-1 text-sm text-amber-800 dark:text-amber-300"
            >
              {{ claim.first_name }} {{ claim.last_name }}
              <span class="text-xs text-amber-500">Pending</span>
              <template v-if="authStore.isAdmin">
                <button @click="confirmClaim(claim.claim_id)" class="text-green-600 hover:text-green-800 text-xs font-medium ml-1">Confirm</button>
                <button @click="removeClaim(claim.claim_id)" class="text-red-400 hover:text-red-600 ml-0.5">&times;</button>
              </template>
              <button v-else-if="claim.user_id === authStore.activeUser?.user_id" @click="removeClaim(claim.claim_id)" class="text-amber-400 hover:text-red-500 ml-1">&times;</button>
            </span>
            <!-- Request button -->
            <button
              v-if="!hasUserClaimed(bedroom)"
              @click="requestRoom(bedroom.bedroom_id)"
              class="inline-flex items-center gap-1 border border-dashed border-trip-accent/40 dark:border-trip-accent/30 rounded-md px-2.5 py-1 text-sm text-trip-accent hover:bg-trip-accent-light dark:hover:bg-trip-accent/10 transition-colors"
            >
              + Request Room
            </button>
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
