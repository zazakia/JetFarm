import { supabase } from '../../database/supabase';
import { CicValidationReport } from './CicValidatorService';
import { ErrorService } from "../ErrorService";

export interface CicSubmission {
  id: string;
  period: string;
  submission_type: 'regular' | 'special';
  file_name: string | null;
  file_hash: string | null;
  record_count: number | null;
  ds_count: number | null;
  ci_count: number | null;
  ne_count: number | null;
  validation_status: 'pending' | 'passed' | 'failed' | 'partial';
  validation_errors: any | null;
  status: 'draft' | 'validated' | 'submitted' | 'rejected' | 'accepted';
  oer_response: string | null;
  dispute_ref: string | null;
  notes: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  created_at: string;
}

export class CicSubmissionLogService {
  /** Create a new draft submission log entry. Returns the log id. */
  static async createDraft(
    period: string,
    submissionType: 'regular' | 'special',
    submittedBy: string,
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('cic_submissions')
      .insert({
        period,
        submission_type: submissionType,
        status: 'draft',
        validation_status: 'pending',
        submitted_by: submittedBy,
      })
      .select('id')
      .single();
    if (error) {
      ErrorService.handleError(error, '[CicLog] createDraft error:');
      return null;
    }
    return data?.id ?? null;
  }

  /** Record validation result against an existing log entry. Append-only. */
  static async logValidation(
    logId: string,
    report: CicValidationReport,
  ): Promise<boolean> {
    // Append-only: insert a new updated row
    const { data: existing } = await supabase
      .from('cic_submissions')
      .select('*')
      .eq('id', logId)
      .single();
    if (!existing) return false;

    const { error } = await supabase
      .from('cic_submissions')
      .insert({
        period: existing.period,
        submission_type: existing.submission_type,
        validation_status: report.overall_status,
        validation_errors: {
          subject_errors: report.subject_results
            .filter((r) => r.errors.length > 0 || r.warnings.length > 0)
            .map((r) => ({ ...r })),
          contract_errors: report.contract_results.filter((r) => r.errors.length > 0),
          blocking_errors: report.blocking_errors,
        },
        status: report.overall_status === 'passed' ? 'validated' : 'draft',
        ds_count: report.total_subjects,
        ci_count: report.total_contracts,
        submitted_by: existing.submitted_by,
        notes: `Validation run at ${report.validated_at}`,
      });
    if (error) {
      ErrorService.handleError(error, '[CicLog] logValidation error:');
      return false;
    }
    return true;
  }

  /** Record file generation result */
  static async logFileGenerated(opts: {
    period: string;
    submission_type: 'regular' | 'special';
    file_name: string;
    file_hash: string;
    record_count: number;
    ds_count: number;
    ci_count: number;
    ne_count: number;
    submitted_by: string;
  }): Promise<string | null> {
    const { data, error } = await supabase
      .from('cic_submissions')
      .insert({
        ...opts,
        validation_status: 'passed',
        status: 'validated',
      })
      .select('id')
      .single();
    if (error) {
      ErrorService.handleError(error, '[CicLog] logFileGenerated error:');
      return null;
    }
    return data?.id ?? null;
  }

  /** Mark a submission as submitted (after staff manually uploads to CIC portal) */
  static async logSubmitted(opts: {
    period: string;
    submission_type: 'regular' | 'special';
    file_name: string;
    submitted_by: string;
    oer_response?: string;
    notes?: string;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('cic_submissions')
      .insert({
        period: opts.period,
        submission_type: opts.submission_type,
        file_name: opts.file_name,
        validation_status: 'passed',
        status: 'submitted',
        submitted_by: opts.submitted_by,
        submitted_at: new Date().toISOString(),
        oer_response: opts.oer_response ?? null,
        notes: opts.notes ?? null,
      });
    if (error) {
      ErrorService.handleError(error, '[CicLog] logSubmitted error:');
      return false;
    }
    return true;
  }

  /** Log a Special Submission (Dispute Correction Notice response) */
  static async logSpecialSubmission(opts: {
    period: string;
    dispute_ref: string;
    file_name: string;
    submitted_by: string;
    notes?: string;
  }): Promise<boolean> {
    const { error } = await supabase
      .from('cic_submissions')
      .insert({
        period: opts.period,
        submission_type: 'special',
        file_name: opts.file_name,
        dispute_ref: opts.dispute_ref,
        validation_status: 'passed',
        status: 'submitted',
        submitted_by: opts.submitted_by,
        submitted_at: new Date().toISOString(),
        notes: opts.notes ?? null,
      });
    if (error) {
      ErrorService.handleError(error, '[CicLog] logSpecialSubmission error:');
      return false;
    }
    return true;
  }

  /** Fetch all submission log entries (newest first) */
  static async getHistory(limit = 50): Promise<CicSubmission[]> {
    const { data, error } = await supabase
      .from('cic_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      ErrorService.handleError(error, '[CicLog] getHistory error:');
      return [];
    }
    return (data ?? []) as CicSubmission[];
  }

  /** Get the most recent submission for a given period */
  static async getLatestForPeriod(
    period: string,
    type: 'regular' | 'special',
  ): Promise<CicSubmission | null> {
    const { data } = await supabase
      .from('cic_submissions')
      .select('*')
      .eq('period', period)
      .eq('submission_type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return (data as CicSubmission) ?? null;
  }
}
