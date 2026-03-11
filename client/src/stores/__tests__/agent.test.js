import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAgentStore } from '../agent.js';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('agent store', () => {
  describe('initial state', () => {
    it('starts with null pending action and result', () => {
      const store = useAgentStore();
      expect(store.pendingAction).toBeNull();
      expect(store.lastActionResult).toBeNull();
    });
  });

  describe('dispatch', () => {
    it('sets pendingAction', () => {
      const store = useAgentStore();
      const action = { type: 'claim-bed', bedId: 3 };
      store.dispatch(action);
      expect(store.pendingAction).toEqual(action);
    });
  });

  describe('clearAction', () => {
    it('clears pendingAction', () => {
      const store = useAgentStore();
      store.dispatch({ type: 'test' });
      store.clearAction();
      expect(store.pendingAction).toBeNull();
    });
  });

  describe('setResult', () => {
    it('sets lastActionResult', () => {
      const store = useAgentStore();
      const result = { success: true, message: 'Bed claimed!' };
      store.setResult(result);
      expect(store.lastActionResult).toEqual(result);
    });
  });

  describe('clearResult', () => {
    it('clears lastActionResult', () => {
      const store = useAgentStore();
      store.setResult({ success: true, message: 'Done' });
      store.clearResult();
      expect(store.lastActionResult).toBeNull();
    });
  });

  describe('full action workflow', () => {
    it('dispatch → setResult → clearAction → clearResult', () => {
      const store = useAgentStore();

      // Agent dispatches action
      store.dispatch({ type: 'add-activity', formData: { title: 'Hiking' } });
      expect(store.pendingAction).not.toBeNull();

      // Page view executes and reports result
      store.setResult({ success: true, message: 'Activity added' });
      expect(store.lastActionResult.success).toBe(true);

      // Cleanup
      store.clearAction();
      store.clearResult();
      expect(store.pendingAction).toBeNull();
      expect(store.lastActionResult).toBeNull();
    });
  });
});
