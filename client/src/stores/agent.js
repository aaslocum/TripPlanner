import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Agent store — acts as an event bus between GlobalAgentPanel and page views.
 *
 * When the agent panel decides to take an action (add activity, claim bed,
 * center map), it calls dispatch(action). The relevant page view watches
 * pendingAction and executes the operation, then calls clearAction().
 */
export const useAgentStore = defineStore('agent', () => {
  // The current pending action to be executed by a page view.
  // Shape: { type: string, ...payload } | null
  const pendingAction = ref(null);

  function dispatch(action) {
    pendingAction.value = action;
  }

  function clearAction() {
    pendingAction.value = null;
  }

  return { pendingAction, dispatch, clearAction };
});
