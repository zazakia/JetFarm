import { MembershipService } from '../MembershipService';
import { ShareCapitalService } from '../ShareCapitalService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        write: jest.fn().mockImplementation((callback) => callback()),
        batch: jest.fn().mockResolvedValue(true),
        get: jest.fn()
    }
}));

jest.mock('../ShareCapitalService', () => ({
    ShareCapitalService: {
        getCurrentBalance: jest.fn(),
        getHistory: jest.fn()
    }
}));

jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: {
        prepareLogActions: jest.fn().mockResolvedValue([]),
        logAction: jest.fn().mockResolvedValue({})
    }
}));

describe('MembershipService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('approveMembership', () => {
        it('assigns associate membership if criteria not fully met', async () => {
            const mockUpdate = jest.fn();
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue({ update: mockUpdate }),
                query: jest.fn().mockReturnValue({
                    fetchCount: jest.fn().mockResolvedValue(100)
                })
            });

            // 15 shares subscribed, 2 paid -> Associate
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                shares: 2
            });
            (ShareCapitalService.getHistory as jest.Mock).mockResolvedValue([
                { transactionType: 'SUBSCRIPTION', numberOfShares: 15 }
            ]);

            await MembershipService.approveMembership('borrower-1', 'RES-123', 'admin');

            expect(mockUpdate).toHaveBeenCalled();
            const updateCallback = mockUpdate.mock.calls[0][0];
            const record: any = {};
            updateCallback(record);

            expect(record.membershipStatus).toBe('active');
            expect(record.membershipType).toBe('associate');
            expect(record.bodResolutionNumber).toBe('RES-123');
            expect(record.membershipNumber).toMatch(/^M\d{2}-0101$/); // e.g. M26-0101
        });

        it('assigns regular membership if >= 20 subscribed and >= 5 paid shares', async () => {
            const mockUpdate = jest.fn();
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue({ update: mockUpdate }),
                query: jest.fn().mockReturnValue({
                    fetchCount: jest.fn().mockResolvedValue(50)
                })
            });

            // 20 shares subscribed, 5 paid -> Regular
            (ShareCapitalService.getCurrentBalance as jest.Mock).mockResolvedValue({
                shares: 5
            });
            (ShareCapitalService.getHistory as jest.Mock).mockResolvedValue([
                { transactionType: 'SUBSCRIPTION', numberOfShares: 20 },
                { transactionType: 'SUBSCRIPTION', numberOfShares: undefined }
            ]);

            await MembershipService.approveMembership('borrower-1', 'RES-456', 'admin');

            expect(mockUpdate).toHaveBeenCalled();
            const updateCallback = mockUpdate.mock.calls[0][0];
            const record: any = {};
            updateCallback(record);

            expect(record.membershipStatus).toBe('active');
            expect(record.membershipType).toBe('regular');
            expect(record.bodResolutionNumber).toBe('RES-456');
            expect(record.membershipNumber).toMatch(/^M\d{2}-0051$/);
        });
    });

    describe('linkMemberToUser', () => {
        it('links target member to user authId and unlinks previous member', async () => {
            const mockPrevPrepareUpdate = jest.fn((cb) => {
                const rec: any = {};
                cb(rec);
                return rec;
            });
            const prevLinked = { id: 'borrower-prev', authId: 'user-100', prepareUpdate: mockPrevPrepareUpdate };

            const mockTargetPrepareUpdate = jest.fn((cb) => {
                const rec: any = {};
                cb(rec);
                return rec;
            });
            const targetBorrower = { id: 'borrower-target', authId: '', prepareUpdate: mockTargetPrepareUpdate };

            (database.get as jest.Mock).mockReturnValue({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([prevLinked])
                }),
                find: jest.fn().mockResolvedValue(targetBorrower)
            });

            const res = await MembershipService.linkMemberToUser('borrower-target', 'user-100');
            expect(res).toBe(targetBorrower);
            expect(mockPrevPrepareUpdate).toHaveBeenCalled();
            expect(mockTargetPrepareUpdate).toHaveBeenCalled();
            expect(database.batch).toHaveBeenCalled();
        });

        it('no-ops if member is already linked to authId', async () => {
            const targetBorrower = { id: 'borrower-target', authId: 'user-100', prepareUpdate: jest.fn() };

            (database.get as jest.Mock).mockReturnValue({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([])
                }),
                find: jest.fn().mockResolvedValue(targetBorrower)
            });

            const res = await MembershipService.linkMemberToUser('borrower-target', 'user-100');
            expect(res).toBe(targetBorrower);
            expect(targetBorrower.prepareUpdate).not.toHaveBeenCalled();
        });
    });

    describe('unlinkMemberFromUser', () => {
        it('clears authId on member when linked', async () => {
            const mockUpdate = jest.fn().mockImplementation((cb) => {
                const rec: any = {};
                cb(rec);
                return rec;
            });
            const borrower = { id: 'b-1', authId: 'user-100', update: mockUpdate };

            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(borrower)
            });

            await MembershipService.unlinkMemberFromUser('b-1');

            expect(mockUpdate).toHaveBeenCalled();
            const cb = mockUpdate.mock.calls[0][0];
            const rec: any = {};
            cb(rec);
            expect(rec.authId).toBe('');
        });

        it('does nothing if borrower has no authId', async () => {
            const mockUpdate = jest.fn();
            const borrower = { id: 'b-1', authId: '', update: mockUpdate };

            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(borrower)
            });

            await MembershipService.unlinkMemberFromUser('b-1');

            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });
});

