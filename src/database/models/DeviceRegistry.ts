import { Model } from '@nozbe/watermelondb'
import { field, date } from '@nozbe/watermelondb/decorators'

export default class DeviceRegistry extends Model {
    static table = 'device_registry'

    @field('device_id') deviceId!: string
    @field('branch_id') branchId!: string
    @field('device_name') deviceName!: string | null
    @field('device_model') deviceModel!: string | null
    @field('os_version') osVersion!: string | null
    @field('app_version') appVersion!: string | null
    @field('is_locked') isLocked!: boolean
    @field('wipe_requested') wipeRequested!: boolean
    @date('wipe_completed_at') wipeCompletedAt!: Date | null
    @date('last_heartbeat') lastHeartbeat!: Date | null
    @date('last_sync_at') lastSyncAt!: Date | null
    @field('last_ip_address') lastIpAddress!: string | null
    @field('is_active') isActive!: boolean
    @date('registered_at') registeredAt!: Date | null

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
    @date('deleted_at') deletedAt!: Date | null
}
