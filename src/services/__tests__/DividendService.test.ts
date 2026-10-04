/**
 * DividendService — Phase 1 AI-authored test suite (trial).
 *
 * Pins the cooperative dividend policy math documented in the service:
 * ISC proportional to paid-up capital, PR split equally across eligible
 * members, and the Annual-GA absentee penalty plowing PR back to CBU.
 *
 * Share balances and surplus-distribution percentages come from
 * collaborators that have their own suites — mocked here to isolate
 * DividendService's allocation logic.
 */
import { Database } from '@nozbe/watermelondb';

jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    return { database: createTestDatabase() };
});

jest.mock('../ShareCapitalService', () => ({
    ShareCapitalService: { getCurrentBalance: jest.fn() },
}));

jest.mock('../CooperativeFundService', () => ({
    CooperativeFundService: { calculateSurplusDistribution: jest.fn() },
}));

import { database } from '../../database';
import Borrower from '../../database/models/Borrower';
import MeetingAttendance from '../../database/models/MeetingAttendance';
import { ShareCapitalService } from '../ShareCapitalService';
import { CooperativeFundService } from '../CooperativeFundService';
import { DividendService } from '../DividendService';

const getCurrentBalance = ShareCapitalService.getCurrentBalance as jest.Mock;
const calculateSurplus = CooperativeFundService.calculateSurplusDistribution as jest.Mock;

async function seedMember(overrides: {
    id?: string; fullName?: string; membershipNumber?: string;
    membershipStatus?: string; membershipType?: string;
} = {}) {
    return database.write(async () =>
        database.get<Borrower>('borrowers').create((rec) => {
            rec.fullName = overrides.fullName ?? 'Juan Dela Cruz';
            rec.membershipNumber = overrides.membershipNumber ?? 'MEM-001';
            if (overrides.membershipStatus) rec.membershipStatus = overrides.membershipStatus;
            if (overrides.membershipType) rec.membershipType = overrides.membershipType;
        }),
    );
}

async function seedAttendance(memberId: string, meetingDate: Date, isPresent: boolean, meetingType = 'annual_ga') {
    return database.write(async () =>
        database.get<MeetingAttendance>('meeting_attendance').create((rec) => {
            rec.memberId = memberId;
            rec.meetingType = meetingType;
            rec.meetingDate = meetingDate.getTime() as any;
            rec.isPresent = isPresent;
        }),
    );
}

beforeEach(async () => {
    jest.clearAllMocks();
    await database.write(async () => {
        for (const table of ['borrowers', 'meeting_attendance']) {
            const rows = await database.get(table).query().fetch();
            for (const row of rows) await row.destroyPermanently();
        }
    });
});

describe('DividendService.calculateDistribution — eligibility & pools', () => {
    it('returns an empty summary when there are no members', async () => {
        const out = await DividendService.calculateDistribution(2024, 1000, 300);
        expect(out).toMatchObject({
            year: 2024, totalISCPool: 1000, totalPRPool: 300,
            iscRatePercent: 0, prRatePercent: 0,
            members: [], absenteesCount: 0, amountPlowedBackToCBU: 0,
        });
    });

    it('counts only active regular members', async () => {
        const a = await seedMember({ fullName: 'A', membershipNumber: 'M-A' });
        await seedMember({ fullName: 'Dormant', membershipStatus: 'dormant' });
        await seedMember({ fullName: 'Associate', membershipType: 'associate' });
        getCurrentBalance.mockResolvedValue({ shares: 100, amount: 10000 });

        const out = await DividendService.calculateDistribution(2024, 1000, 300);
        expect(out.members).toHaveLength(1);
        expect(out.members[0].memberId).toBe(a.id);
    });

    it('splits ISC proportionally to paid-up capital and PR equally per member', async () => {
        const a = await seedMember({ fullName: 'AAA' });
        const b = await seedMember({ fullName: 'BBB' });
        getCurrentBalance.mockImplementation(async (id: string) =>
            id === a.id
                ? { shares: 100, amount: 10000 }
                : { shares: 50, amount: 5000 },
        );

        const out = await DividendService.calculateDistribution(2024, 1000, 300);
        const byName = Object.fromEntries(out.members.map((m) => [m.memberName, m]));

        // total paid-up 15000 → isc rate 1000/15000
        expect(byName['AAA'].interestOnShareCapital).toBeCloseTo(666.67, 2);
        expect(byName['BBB'].interestOnShareCapital).toBeCloseTo(333.33, 2);
        expect(byName['AAA'].patronageRefund).toBe(150); // 300 / 2 members
        expect(byName['BBB'].patronageRefund).toBe(150);
        expect(out.iscRatePercent).toBeCloseTo(100 / 15, 4);
        expect(out.prRatePercent).toBe(50);
        expect(out.amountPlowedBackToCBU).toBe(0);
    });

    it('treats everyone as present when the GA has no attendance records at all', async () => {
        await seedMember();
        getCurrentBalance.mockResolvedValue({ shares: 10, amount: 1000 });
        const out = await DividendService.calculateDistribution(2024, 100, 50);
        expect(out.members[0].attendedGA).toBe(true);
        expect(out.members[0].finalPatronageRefund).toBe(50);
    });
});

describe('DividendService — GA absentee penalty', () => {
    it('absent member loses PR to CBU; present member keeps both', async () => {
        const a = await seedMember({ fullName: 'Presento' });
        const b = await seedMember({ fullName: 'Absento' });
        getCurrentBalance.mockImplementation(async (id: string) =>
            id === a.id ? { shares: 100, amount: 10000 } : { shares: 50, amount: 5000 },
        );
        await seedAttendance(a.id, new Date(2024, 5, 20), true);
        await seedAttendance(b.id, new Date(2024, 5, 20), false);

        const out = await DividendService.calculateDistribution(2024, 1000, 300);
        expect(out.absenteesCount).toBe(1);
        expect(out.amountPlowedBackToCBU).toBe(150);

        expect(out.members[0].memberName).toBe('Presento'); // sorted by benefit desc
        expect(out.members[0].finalPatronageRefund).toBe(150);
        expect(out.members[0].totalBenefit).toBeCloseTo(816.67, 2);
        expect(out.members[1].attendedGA).toBe(false);
        expect(out.members[1].finalPatronageRefund).toBe(0);
        expect(out.members[1].patronageRefund).toBe(150); // pre-penalty figure retained
        expect(out.members[1].totalBenefit).toBeCloseTo(333.33, 2);
    });

    it('honors an explicit gaYear instead of the fiscal year', async () => {
        const a = await seedMember({ fullName: 'Checker' });
        getCurrentBalance.mockResolvedValue({ shares: 10, amount: 1000 });
        await seedAttendance(a.id, new Date(2023, 5, 10), false); // absent in 2023 GA

        // Fiscal 2024, attendance checked against 2023 GA → member absent
        const out2023 = await DividendService.calculateDistribution(2024, 100, 60, 2023);
        expect(out2023.absenteesCount).toBe(1);
        expect(out2023.amountPlowedBackToCBU).toBe(60);

        // Without gaYear, 2024 has zero attendance rows → everyone present
        const outDefault = await DividendService.calculateDistribution(2024, 100, 60);
        expect(outDefault.absenteesCount).toBe(0);
    });

    it('ignores non-annual meeting attendance', async () => {
        const a = await seedMember();
        getCurrentBalance.mockResolvedValue({ shares: 10, amount: 1000 });
        await seedAttendance(a.id, new Date(2024, 5, 20), false, 'semi_annual');
        const out = await DividendService.calculateDistribution(2024, 100, 60);
        expect(out.absenteesCount).toBe(0);
    });
});

describe('DividendService.calculateDistributionFromNetIncome', () => {
    it('routes pools through the 70/30 surplus split and passes figures through', async () => {
        calculateSurplus.mockResolvedValue({
            netSurplus: 70000,
            interestOnShareCapital: 49000,
            patronageRefund: 21000,
        });
        const a = await seedMember();
        getCurrentBalance.mockResolvedValue({ shares: 490, amount: 49000 });

        const out = await DividendService.calculateDistributionFromNetIncome(2024, 100000);

        expect(calculateSurplus).toHaveBeenCalledWith(100000);
        expect(out.netIncome).toBe(100000);
        expect(out.netSurplusForDistribution).toBe(70000);
        expect(out.totalISCPool).toBe(49000);
        expect(out.totalPRPool).toBe(21000);
        expect(out.members[0].interestOnShareCapital).toBe(49000); // sole member takes full pool
        expect(out.members[0].finalPatronageRefund).toBe(21000);
    });
});

describe('DividendService.getRecordedGAYears', () => {
    it('lists distinct annual-GA years, newest first, excluding other meeting types', async () => {
        const a = await seedMember();
        await seedAttendance(a.id, new Date(2024, 5, 20), true);
        await seedAttendance(a.id, new Date(2023, 6, 15), true);
        await seedAttendance(a.id, new Date(2024, 11, 1), true, 'semi_annual');

        expect(await DividendService.getRecordedGAYears()).toEqual([2024, 2023]);
    });
});
