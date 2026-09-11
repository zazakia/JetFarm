jest.mock('../../utils/e2eEnvironment', () => ({
    isLocalWebE2E: jest.fn(() => false),
}));

jest.mock('../../database/supabase', () => ({
    supabase: {
        from: jest.fn(),
        auth: {
            getSession: jest.fn(),
        },
    },
}));

jest.mock('../../utils/SecureStorageAdapter', () => ({
    SecureStorageAdapter: {
        getItem: jest.fn(async () => 'pos-web-test1234'),
        setItem: jest.fn(async () => undefined),
        removeItem: jest.fn(async () => undefined),
    },
}));

describe('DeviceSecurityService', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('skips remote device_registry writes in E2E mode', async () => {
        const { isLocalWebE2E } = require('../../utils/e2eEnvironment');
        isLocalWebE2E.mockReturnValue(true);

        const { supabase } = require('../../database/supabase');
        const { deviceSecurityService } = require('../DeviceSecurityService');

        const status = await deviceSecurityService.checkAndReportStatus('branch-1');

        expect(status.deviceId).toBe('pos-web-test1234');
        expect(status.branchId).toBe('branch-1');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('skips remote device_registry writes when unauthenticated (prevents 401)', async () => {
        const { isLocalWebE2E } = require('../../utils/e2eEnvironment');
        isLocalWebE2E.mockReturnValue(false);

        const { supabase } = require('../../database/supabase');
        supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

        const { deviceSecurityService } = require('../DeviceSecurityService');
        const status = await deviceSecurityService.checkAndReportStatus('branch-1');

        expect(status.deviceId).toBe('pos-web-test1234');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('queries remote device_registry when authenticated', async () => {
        const { isLocalWebE2E } = require('../../utils/e2eEnvironment');
        isLocalWebE2E.mockReturnValue(false);

        const { supabase } = require('../../database/supabase');
        supabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'admin-1' } } },
            error: null,
        });

        const mockMaybeSingle = jest.fn().mockResolvedValue({
            data: { is_locked: false, wipe_requested: false, branch_id: 'branch-1' },
            error: null,
        });
        const mockSelect = jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                maybeSingle: mockMaybeSingle,
            }),
        });
        const mockUpdate = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
        });

        supabase.from.mockImplementation((table: string) => {
            if (table === 'device_registry') {
                return {
                    select: mockSelect,
                    update: mockUpdate,
                };
            }
            return {};
        });

        const { deviceSecurityService } = require('../DeviceSecurityService');
        const status = await deviceSecurityService.checkAndReportStatus('branch-1');

        expect(status.deviceId).toBe('pos-web-test1234');
        expect(status.isLocked).toBe(false);
        expect(supabase.from).toHaveBeenCalledWith('device_registry');
    });
});
