import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, relation } from '@nozbe/watermelondb/decorators'

export default class MeetingAttendance extends Model {
    static table = 'meeting_attendance'

    @relation('borrowers', 'member_id') member: any;
    @field('member_id') memberId: string;
    @field('meeting_type') meetingType: string;
    @date('meeting_date') meetingDate: number;
    @field('is_present') isPresent: boolean | null;
    @field('notes') notes: string | null;

    @readonly @date('created_at') createdAt: number;
    @readonly @date('updated_at') updatedAt: number;
    @date('deleted_at') deletedAt: number | null;
}
