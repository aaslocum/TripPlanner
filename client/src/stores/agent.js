import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * Agent store — acts as an event bus between GlobalAgentPanel and page views.
 *
 * When the agent panel decides to take an action (add activity, claim bed,
 * center map), it calls dispatch(action). The relevant page view watches
 * pendingAction and executes the operation, then calls clearAction().
 *
 * After executing, the page view calls setResult() so the panel can display
 * success/error feedback instead of closing blindly.
 */
export const useAgentStore = defineStore('agent', () => {
  // The current pending action to be executed by a page view.
  // Shape: { type: string, ...payload } | null
  const pendingAction = ref(null);

  // Result of the last executed action (for feedback in the panel).
  // Shape: { success: boolean, message: string } | null
  const lastActionResult = ref(null);

  function dispatch(action) {
    pendingAction.value = action;
  }

  function clearAction() {
    pendingAction.value = null;
  }

  function setResult(result) {
    lastActionResult.value = result;
  }

  function clearResult() {
    lastActionResult.value = null;
  }

  return { pendingAction, lastActionResult, dispatch, clearAction, setResult, clearResult };
});
