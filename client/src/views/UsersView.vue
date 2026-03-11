<script setup>
import { ref, onMounted } from 'vue';
import apiClient from '../api/client';

const users = ref([]);
const loading = ref(false);
const showForm = ref(false);
const form = ref({ first_name: '', last_name: '', email: '', role: 'user' });

async function fetchUsers() {
  loading.value = true;
  try {
    const { data } = await apiClient.get('/users');
    users.value = data.data;
  } finally {
    loading.value = false;
  }
}

async function addUser() {
  await apiClient.post('/users', form.value);
  form.value = { first_name: '', last_name: '', email: '', role: 'user' };
  showForm.value = false;
  await fetchUsers();
}

async function deleteUser(id) {
  if (!confirm('Are you sure you want to remove this user? This cannot be undone.')) return;
  await apiClient.delete(`/users/${id}`);
  await fetchUsers();
}

onMounted(fetchUsers);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-2xl font-display font-black uppercase tracking-wide text-flag-black dark:text-warm-100">Users</h2>
      <button @click="showForm = !showForm" class="bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover transition-colors">
        {{ showForm ? 'Cancel' : '+ Add User' }}
      </button>
    </div>

    <div v-if="showForm" class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">First Name</label>
          <input v-model="form.first_name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Last Name</label>
          <input v-model="form.last_name" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Email</label>
          <input v-model="form.email" type="email" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-warm-700 dark:text-warm-300 mb-1">Role</label>
          <select v-model="form.role" class="w-full border border-warm-300 dark:border-dark-border rounded-lg px-3 py-2 text-sm dark:bg-dark-raised dark:text-warm-100">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button @click="addUser" class="mt-4 bg-trip-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-trip-accent-hover">Save</button>
    </div>

    <div class="bg-surface dark:bg-dark-surface rounded-xl shadow-sm border border-warm-200 dark:border-dark-border overflow-x-auto">
      <table class="w-full min-w-[500px]">
        <thead class="bg-warm-50 dark:bg-dark-raised">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Name</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Email</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Role</th>
            <th class="text-right px-6 py-3 text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-warm-200 dark:divide-dark-border">
          <tr v-for="user in users" :key="user.user_id" class="hover:bg-warm-50 dark:hover:bg-dark-raised">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-trip-accent-light dark:bg-trip-accent/20 flex items-center justify-center text-sm font-medium text-trip-accent dark:text-trip-accent">
                  {{ user.first_name?.[0] }}{{ user.last_name?.[0] }}
                </div>
                <span class="text-sm font-medium text-flag-black dark:text-warm-100">{{ user.first_name }} {{ user.last_name }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-warm-500 dark:text-warm-400">{{ user.email }}</td>
            <td class="px-6 py-4">
              <span class="text-xs font-medium px-2 py-1 rounded-full"
                :class="user.role === 'admin' ? 'bg-trip-accent-light dark:bg-trip-accent/20 text-trip-accent dark:text-trip-accent' : 'bg-warm-200 dark:bg-dark-raised text-warm-700 dark:text-warm-300'">
                {{ user.role }}
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button @click="deleteUser(user.user_id)" class="text-red-400 hover:text-red-600 text-sm">Remove</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
