import { database } from '../database';
import Borrower from '../database/models/Borrower';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import MeetingAttendance from '../database/models/MeetingAttendance';
import { ShareCapitalService } from './ShareCapitalService';
import { CooperativeFundService } from './CooperativeFundService';
import { Q } from '@nozbe/watermelondb';

export interface MemberDividendSummary {
    memberId: string;
    memberName: string;
    membershipNumber: string;
    paidUpShares: number;
    paidUpAmount: number;
    interestOnShareCapital: number; // ISC
    patronageRefund: number; // PR before penalty
    attendedGA: boolean;
    finalPatronageRefund: number; // PR after penalty (if absent, PR goes to CBU)
    totalBenefit: number;
}

export interface DividendDistributionSummary {
    year: number;
    netIncome?: number;
    netSurplusForDistribution?: number;
    totalISCPool: number;
    totalPRPool: number;
    iscRatePercent: number;
    prRatePercent: number;
    members: MemberDividendSummary[];
    absenteesCount: number;
    amountPlowedBackToCBU: number;
}

export class DividendService {
    static async calculateDistributionFromNetIncome(
        year: number,
        netIncome: number,
        gaYear?: number
    ): Promise<DividendDistributionSummary> {
        const distribution = await CooperativeFundService.calculateSurplusDistribution(netIncome);
        const result = await this.calculateDistribution(
            year,
            distribution.interestOnShareCapital,
            distribution.patronageRefund,
            gaYear
        );

        return {
            ...result,
            netIncome,
            netSurplusForDistribution: distribution.netSurplus,
        };
    }

    /**
     * Calculate ISC (Interest on Share Capital) and PR (Patronage Refund)
     * for all active members for a given year.
     *
     * Policy (POS Cursor Manual):
     * - Net income allocates 70% to net surplus for distribution to members.
     * - ISC: 70% of the net surplus for distribution, applied to paid-up share capital
     * - PR: 30% of the net surplus for distribution
     * - GA Absentee Penalty: If a member is absent from the Annual GA without
     *   valid reason approved by BOD, their PR is plowed back to their CBU (share capital).
     *
     * @param year              The fiscal year
     * @param totalISCPool      Total peso amount available for ISC distribution
     * @param totalPRPool       Total peso amount available for PR distribution
     * @param gaYear            The year of the General Assembly to check attendance (default = same year)
     */
    static async calculateDistribution(
        year: number,
        totalISCPool: number,
        totalPRPool: number,
        gaYear?: number
    ): Promise<DividendDistributionSummary> {
        const targetGAYear = gaYear ?? year;

        // 1. Get all active regular members
        const allMembers = await database
            .get<Borrower>('borrowers')
            .query(
                Q.where('deleted_at', null)
            )
            .fetch();

        const members = allMembers.filter(b => {
            const s = ((b as any).membershipStatus || 'active').toString().toLowerCase();
            const t = ((b as any).membershipType || 'regular').toString().toLowerCase();
            return s === 'active' && t === 'regular';
        });

        if (members.length === 0) {
            return {
                year,
                totalISCPool,
                totalPRPool,
                iscRatePercent: 0,
                prRatePercent: 0,
                members: [],
                absenteesCount: 0,
                amountPlowedBackToCBU: 0,
            };
        }

        // 2. Calculate total paid-up share capital across all members
        const memberBalances: { member: Borrower; shares: number; amount: number }[] = [];
        let totalPaidUpAmount = 0;

        for (const member of members) {
            const balance = await ShareCapitalService.getCurrentBalance(member.id);
            memberBalances.push({ member, shares: balance.shares, amount: balance.amount });
            totalPaidUpAmount += balance.amount;
        }

        // 3. Get GA attendance for the target year
        const gaStartOfYear = new Date(targetGAYear, 0, 1).getTime();
        const gaEndOfYear = new Date(targetGAYear, 11, 31, 23, 59, 59).getTime();

        const attendanceRecords = await database
            .get<MeetingAttendance>('meeting_attendance')
            .query(
                Q.where('meeting_type', 'annual_ga'),
                Q.where('meeting_date', Q.between(gaStartOfYear, gaEndOfYear)),
                Q.where('deleted_at', null)
            )
            .fetch();

        // Build set of present member IDs
        const presentMemberIds = new Set(
            attendanceRecords.filter(r => r.isPresent).map(r => r.memberId)
        );

        // 4. Calculate ISC rate (per peso of paid-up capital)
        const iscRate = totalPaidUpAmount > 0 ? totalISCPool / totalPaidUpAmount : 0;
        const iscRatePercent = iscRate * 100;

        // 5. PR: Distribute equally per member (simple equal-share method)
        //    In a more advanced implementation, this can be proportional to loan usage.
        const prPerMember = members.length > 0 ? totalPRPool / members.length : 0;
        const prRatePercent = members.length > 0 ? (prPerMember / (totalPRPool || 1)) * 100 : 0;

        // 6. Build per-member summary
        let absenteesCount = 0;
        let amountPlowedBackToCBU = 0;

        const memberSummaries: MemberDividendSummary[] = memberBalances.map(({ member, shares, amount }) => {
            const isc = Math.round(amount * iscRate * 100) / 100;
            const pr = Math.round(prPerMember * 100) / 100;
            const attendedGA = attendanceRecords.length === 0 || presentMemberIds.has(member.id);

            let finalPR = pr;
            if (!attendedGA) {
                absenteesCount++;
                amountPlowedBackToCBU += pr;
                finalPR = 0; // PR plowed back to CBU
            }

            return {
                memberId: member.id,
                memberName: member.fullName,
                membershipNumber: (member as any).membershipNumber ?? '',
                paidUpShares: shares,
                paidUpAmount: amount,
                interestOnShareCapital: isc,
                patronageRefund: pr,
                attendedGA,
                finalPatronageRefund: finalPR,
                totalBenefit: isc + finalPR,
            };
        });

        // Sort by highest benefit
        memberSummaries.sort((a, b) => b.totalBenefit - a.totalBenefit);

        return {
            year,
            totalISCPool,
            totalPRPool,
            iscRatePercent,
            prRatePercent,
            members: memberSummaries,
            absenteesCount,
            amountPlowedBackToCBU,
        };
    }

    /**
     * Get all Annual GA meetings on record
     */
    static async getRecordedGAYears(): Promise<number[]> {
        const records = await database
            .get<MeetingAttendance>('meeting_attendance')
            .query(
                Q.where('meeting_type', 'annual_ga'),
                Q.where('deleted_at', null)
            )
            .fetch();

        const years = new Set(records.map(r => new Date(r.meetingDate).getFullYear()));
        return Array.from(years).sort((a, b) => b - a);
    }
}
