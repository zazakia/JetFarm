import { Model } from '@nozbe/watermelondb'
import { field, date, children, readonly, relation } from '@nozbe/watermelondb/decorators'
import { EncryptionService } from '../../services/EncryptionService'

export default class Borrower extends Model {
    static table = 'borrowers'

    @field('full_name') fullName: string;
    @field('address') address: string;
    @field('phone') phone: string;
    @field('area') area: string;
    @relation('areas', 'area_id') areaRelation: any;
    @field('area_id') areaId: string | null;
    @field('civil_status') civilStatus: string | null;
    @field('contact_no') contactNo: string | null;
    @field('source_of_income') sourceOfIncome: string | null;
    @field('route_index') routeIndex: number;
    @relation('collectors', 'collector_id') collector: any;
    @field('collector_id') collectorId: string;
    @field('auth_id') authId: string;
    @field('gender') gender: string;
    @field('member_id') memberId: string | null;
    @field('cycle_id') cycleId: number | null;
    @field('loan_code') loanCode: string | null;
    @date('date_joined') dateJoined: number | null;
    @field('membership_status') membershipStatus: string | null;
    @field('notes') notes: string;
    @field('created_by') createdBy: string;
    @field('latitude') latitude: number;
    @field('longitude') longitude: number;
    @field('group') group: string;
    @field('first_name') firstName: string;
    @field('last_name') lastName: string;
    @field('co_maker_name') coMakerName: string;
    @field('business') business: string;
    @field('bank_name') bankName: string;
    @field('bank_account_name') bankAccountName: string;
    @field('bank_account_number') bankAccountNumber: string;
    @field('bank_branch') bankBranch: string;
    @date('date_of_birth') dateOfBirth: number;
    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;

    @children('loans') loans: any;
    @children('savings_transactions') savings_transactions: any;
    @children('dependents') dependents: any;
    @children('children') childrenRecords: any;
    @children('share_capital_transactions') shareCapitalTransactions: any;
    @children('meeting_attendance') meetingAttendance: any;

    @field('membership_number') membershipNumber: string | null;
    @field('tin_number') tinNumber: string | null;
    @field('membership_type') membershipType: string | null;
    @field('bod_resolution_number') bodResolutionNumber: string | null;
    @date('date_accepted') dateAccepted: number | null;
    @field('pmes_completed') pmesCompleted: boolean | null;
    @date('pmes_date') pmesDate: number | null;
    @field('birthplace') birthplace: string | null;
    @field('religion') religion: string | null;
    @field('education_level') educationLevel: string | null;
    @field('employer') employer: string | null;
    @field('salary') salary: number | null;
    @field('other_income_source') otherIncomeSource: string | null;
    @field('nearest_relative') nearestRelative: string | null;
    @field('number_of_dependents') numberOfDependents: number | null;
    @field('spouse_surname') spouseSurname: string | null;
    @field('spouse_first_name') spouseFirstName: string | null;
    @field('spouse_middle_name') spouseMiddleName: string | null;
    @field('spouse_name_extension') spouseNameExtension: string | null;
    @date('spouse_date_of_birth') spouseDateOfBirth: number | null;
    @field('spouse_birthplace') spouseBirthplace: string | null;
    @field('spouse_occupation') spouseOccupation: string | null;
    @field('spouse_phone') spousePhone: string | null;
    @date('termination_date') terminationDate: number | null;
    @field('termination_resolution') terminationResolution: string | null;
    @field('barangay') barangay: string | null;
    @field('city_municipality') cityMunicipality: string | null;
    @field('province') province: string | null;
    @field('zip_code') zipCode: string | null;
    @field('deceased') deceased: boolean | null;
    @date('date_of_death') dateOfDeath: number | null;

    // CIC RA 9510 — Credit Information Corporation fields
    @field('middle_name') middleName: string | null;
    @field('name_suffix') nameSuffix: string | null;             // Jr./Sr./III
    @field('mother_maiden_name') motherMaidenName: string | null; // CIC ID Col 25-27
    @field('sss_number') sssNumber: string | null;               // Gov ID fallback #1
    @field('gsis_number') gsisNumber: string | null;             // Gov ID fallback #2
    @field('philhealth_number') philhealthNumber: string | null; // Gov ID fallback #3

    get decryptedPhone(): string | null {
        return EncryptionService.decrypt(this.phone);
    }

    get decryptedAddress(): string | null {
        return EncryptionService.decrypt(this.address);
    }
}
