import { supabase } from '../../database/supabase';
import { ErrorService } from "../ErrorService";

export interface CicSettings {
  id: string;
  provider_code: string;
  branch_code: string | null;
  cooperative_name: string;
  default_currency: string;
  default_contract_type: number;
  loan_type_map: Record<string, number>;
  alert_push_enabled: boolean;
  alert_email_enabled: boolean;
  alert_email_address: string | null;
  extract_by_day: number;
  validate_by_day: number;
  submit_by_day: number;
}

export class CicSettingsService {
  static async getSettings(): Promise<CicSettings | null> {
    const { data, error } = await supabase
      .from('cic_settings')
      .select('*')
      .limit(1)
      .single();
    if (error) {
      ErrorService.handleError(error, '[CicSettings] getSettings error:');
      return null;
    }
    return data as CicSettings;
  }

  static async updateSettings(updates: Partial<Omit<CicSettings, 'id'>>): Promise<boolean> {
    const { error } = await supabase
      .from('cic_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows (singleton table)
    if (error) {
      ErrorService.handleError(error, '[CicSettings] updateSettings error:');
      return false;
    }
    return true;
  }

  /** Get the loan_type_map with the default_contract_type as fallback */
  static async resolveContractType(loanType: string | null): Promise<number> {
    const settings = await CicSettingsService.getSettings();
    if (!settings) return 22;
    const key = (loanType ?? '').toLowerCase();
    return settings.loan_type_map[key] ?? settings.default_contract_type;
  }
}
