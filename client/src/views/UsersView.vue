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
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Users</h2>
      <button @click="showForm = !showForm" class="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        {{ showForm ? 'Cancel' : '+ Add User' }}
      </button>
    </div>

    <div v-if="showForm" class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name</label>
          <input v-model="form.first_name" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name</label>
          <input v-model="form.last_name" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
          <input v-model="form.email" type="email" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
          <select v-model="form.role" class="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>
      <button @click="addUser" class="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Save</button>
    </div>

    <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table class="w-full min-w-[500px]">
        <thead class="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
            <th class="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
            <th class="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr v-for="user in users" :key="user.user_id" class="hover:bg-gray-50 dark:hover:bg-gray-800">
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {{ user.first_name?.[0] }}{{ user.last_name?.[0] }}
                </div>
                <span class="text-sm font-medium text-gray-900 dark:text-gray-100">{{ user.first_name }} {{ user.last_name }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</td>
            <td class="px-6 py-4">
              <span class="text-xs font-medium px-2 py-1 rounded-full"
                :class="user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'">
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
