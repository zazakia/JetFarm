import { useAppStore } from '../useAppStore';

describe('useAppStore', () => {
  afterEach(() => {
    useAppStore.setState({ isGlobalSyncing: false, selectedTheme: 'light' });
  });

  it('should have initial state', () => {
    const state = useAppStore.getState();
    expect(state.isGlobalSyncing).toBe(false);
    expect(state.selectedTheme).toBe('light');
  });

  it('should set global syncing state', () => {
    useAppStore.getState().setGlobalSyncing(true);
    expect(useAppStore.getState().isGlobalSyncing).toBe(true);
  });

  it('should set theme', () => {
    useAppStore.getState().setTheme('dark');
    expect(useAppStore.getState().selectedTheme).toBe('dark');
  });
});
