import { useSyncStore } from '../syncStore';

describe('syncStore', () => {
  afterEach(() => {
    useSyncStore.getState().reset();
  });

  it('should have initial state', () => {
    const state = useSyncStore.getState();
    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
    expect(state.pendingChanges).toBe(0);
  });

  it('should set sync progress', () => {
    useSyncStore.getState().setSyncProgress({
      status: 'syncing',
      progress: 50,
      currentModel: 'TestModel',
      pendingChanges: 5
    });

    const state = useSyncStore.getState();
    expect(state.status).toBe('syncing');
    expect(state.progress).toBe(50);
    expect(state.currentModel).toBe('TestModel');
    expect(state.pendingChanges).toBe(5);
  });

  it('should reset back to initial state', () => {
    useSyncStore.getState().setSyncProgress({ status: 'error', progress: 100 });
    useSyncStore.getState().reset();

    const state = useSyncStore.getState();
    expect(state.status).toBe('idle');
    expect(state.progress).toBe(0);
  });

  it('should add logs and clear them', () => {
    useSyncStore.getState().addLog({
      type: 'info',
      message: 'Initial log',
      timestamp: new Date()
    });

    let state = useSyncStore.getState();
    expect(state.logs.length).toBe(1);
    expect(state.logs[0].message).toBe('Initial log');
    expect(state.logs[0].id).toBeDefined();

    useSyncStore.getState().clearLogs();
    state = useSyncStore.getState();
    expect(state.logs.length).toBe(0);
  });

  it('should limit logs to 100 entries', () => {
    const timestamp = new Date();
    for (let i = 0; i < 110; i++) {
        useSyncStore.getState().addLog({
            type: 'info',
            message: `Log ${i}`,
            timestamp
        });
    }

    const state = useSyncStore.getState();
    expect(state.logs.length).toBe(100);
    expect(state.logs[0].message).toBe('Log 109');
  });

  it('tracks detailed audit metadata without putting record ids in the summary store', () => {
    useSyncStore.getState().setSyncProgress({
      latestAuditSessionId: 'session-1',
      auditPersistenceWarning: 'Detailed log could not be saved'
    });

    expect(useSyncStore.getState().latestAuditSessionId).toBe('session-1');
    expect(useSyncStore.getState().auditPersistenceWarning).toBe('Detailed log could not be saved');

    useSyncStore.getState().reset();
    expect(useSyncStore.getState().latestAuditSessionId).toBeNull();
    expect(useSyncStore.getState().auditPersistenceWarning).toBeNull();
  });

  it('should set online status', () => {
    useSyncStore.getState().setOnline(false);
    expect(useSyncStore.getState().isOnline).toBe(false);
    
    useSyncStore.getState().setOnline(true);
    expect(useSyncStore.getState().isOnline).toBe(true);
  });
});
