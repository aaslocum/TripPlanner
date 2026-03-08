<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import apiClient from '../../api/client';

const authStore = useAuthStore();
const props = defineProps({
  accommodation: { type: Object, required: true },
});
const emit = defineEmits(['refresh']);

const showForm = ref(false);
const form = ref({ name: '', price_share_adjustment: 0 });

async function addBedroom() {
  await apiClient.post('/bedrooms', {
    accommodation_id: props.accommodation.accommodation_id,
    name: form.value.name,
    price_share_adjustment: Number(form.value.price_share_adjustment) || 0,
  });
  form.value = { name: '', price_share_adjustment: 0 };
  showForm.value = false;
  emit('refresh');
}

async function addBed(bedroomId, bedType) {
  await apiClient.post('/beds', { bedroom_id: bedroomId, bed_type: bedType });
  emit('refresh');
}

async function deleteBedroom(id) {
  await apiClient.delete(`/bedrooms/${id}`);
  emit('refresh');
}

const bedTypes = ['king', 'queen', 'twin', 'full', 'sofa', 'bunk'];
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-gray-900">Bedrooms</h3>
      <button v-if="authStore.isAdmin" @click="showForm = !showForm" class="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
        {{ showForm ? 'Cancel' : '+ Add Bedroom' }}
      </button>
    </div>

    <div v-if="showForm" class="bg-gray-50 rounded-lg p-4 mb-4">
      <div class="flex gap-4 items-end">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-700 mb-1">Room Name</label>
          <input v-model="form.name" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Master Bedroom" />
        </div>
        <div class="w-40">
          <label class="block text-sm font-medium text-gray-700 mb-1">Price Adj ($)</label>
          <input v-model="form.price_share_adjustment" type="number" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button @click="addBedroom" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Add</button>
      </div>
    </div>

    <div v-if="accommodation.bedrooms?.length" class="grid grid-cols-2 gap-4">
      <div v-for="bedroom in accommodation.bedrooms" :key="bedroom.bedroom_id" class="bg-gray-50 rounded-lg overflow-hidden">
        <img v-if="bedroom.images?.length" :src="bedroom.images[0].image_url" class="w-full h-36 object-cover" />
        <div class="p-4">
          <div class="flex items-center justify-between mb-3">
            <h4 class="font-medium text-gray-900">{{ bedroom.name }}</h4>
            <div class="flex items-center gap-2">
              <span v-if="bedroom.price_share_adjustment" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {{ bedroom.price_share_adjustment > 0 ? '+' : '' }}${{ bedroom.price_share_adjustment }}
              </span>
              <button v-if="authStore.isAdmin" @click="deleteBedroom(bedroom.bedroom_id)" class="text-red-400 hover:text-red-600 text-xs">Remove</button>
            </div>
          </div>

          <div class="space-y-2">
            <div v-for="bed in bedroom.beds" :key="bed.bed_id" class="flex items-center justify-between bg-white rounded-md px-3 py-2 text-sm">
              <span class="capitalize">{{ bed.bed_type }}</span>
              <span v-if="bed.first_name" class="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {{ bed.first_name }} {{ bed.last_name }}
              </span>
              <span v-else class="text-xs text-gray-400">Unassigned</span>
            </div>
          </div>

          <div v-if="authStore.isAdmin" class="mt-2">
            <select @change="addBed(bedroom.bedroom_id, $event.target.value); $event.target.value = ''" class="text-xs border border-gray-300 rounded px-2 py-1 text-gray-500">
              <option value="">+ Add bed...</option>
              <option v-for="bt in bedTypes" :key="bt" :value="bt">{{ bt }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <p v-else class="text-sm text-gray-500">No bedrooms added yet.</p>
  </div>
</template>
