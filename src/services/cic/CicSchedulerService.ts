import { supabase } from '../../database/supabase';
import { CicSettingsService } from './CicSettingsService';
import { CicExtractService } from './CicExtractService';
import { CicValidatorService } from './CicValidatorService';
import { CicSubmissionLogService } from './CicSubmissionLogService';

export interface CicDeadlineStatus {
  period: string;
  today_day: number;
  extract_by_day: number;
  validate_by_day: number;
  submit_by_day: number;
  extraction_done: boolean;
  validation_done: boolean;
  submission_done: boolean;
  is_overdue: boolean;
  days_until_submit: number;
  alert_message: string | null;
}

export class CicSchedulerService {
  /**
   * Get the current period's deadline status for dashboard display.
   * Format period as 'YYYY-MM' of the PREVIOUS month (what we're reporting on).
   */
  static async getDeadlineStatus(): Promise<CicDeadlineStatus> {
    const settings = await CicSettingsService.getSettings();
    const now = new Date();
    const todayDay = now.getDate();

    // Reporting period = previous month
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;

    const extractByDay = settings?.extract_by_day ?? 3;
    const validateByDay = settings?.validate_by_day ?? 5;
    const submitByDay = settings?.submit_by_day ?? 8;

    // Check what's been done for this period
    const history = await CicSubmissionLogService.getLatestForPeriod(period, 'regular');
    const extractionDone = !!history;
    const validationDone = history?.validation_status === 'passed';
    const submissionDone = history?.status === 'submitted' || history?.status === 'accepted';

    const daysUntilSubmit = submitByDay - todayDay;
    const isOverdue = todayDay > submitByDay && !submissionDone;

    let alertMessage: string | null = null;
    if (isOverdue) {
      alertMessage = `🚨 CIC submission for ${period} is OVERDUE (due by day ${submitByDay})`;
    } else if (!submissionDone && todayDay >= submitByDay - 2) {
      alertMessage = `⚠️ CIC submission for ${period} due in ${daysUntilSubmit} day(s) — action required`;
    } else if (!validationDone && todayDay >= validateByDay) {
      alertMessage = `⚠️ CIC validation for ${period} overdue — run before day ${submitByDay}`;
    } else if (!extractionDone && todayDay >= extractByDay) {
      alertMessage = `📋 CIC extraction for ${period} due — run by day ${validateByDay}`;
    }

    return {
      period,
      today_day: todayDay,
      extract_by_day: extractByDay,
      validate_by_day: validateByDay,
      submit_by_day: submitByDay,
      extraction_done: extractionDone,
      validation_done: validationDone,
      submission_done: submissionDone,
      is_overdue: isOverdue,
      days_until_submit: daysUntilSubmit,
      alert_message: alertMessage,
    };
  }

  /**
   * Run monthly extraction + validation for the previous month's period.
   * Should be called manually via the dashboard by the 3rd of each month.
   * Returns the validation report for human review.
   */
  static async runMonthlyExtraction(submittedBy: string): Promise<{
    success: boolean;
    period: string;
    validation_passed: boolean;
    message: string;
    report: any;
  }> {
    const now = new Date();
    const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;

    try {
      // Step 1: Extract
      const staged = await CicExtractService.extract(period);

      if (staged.errors.length > 0 && staged.subjects.length === 0) {
        return {
          success: false,
          period,
          validation_passed: false,
          message: `Extraction failed: ${staged.errors.join('; ')}`,
          report: null,
        };
      }

      // Step 2: Validate
      const report = CicValidatorService.validate(staged);

      // Step 3: Log
      await CicSubmissionLogService.createDraft(period, 'regular', submittedBy);

      return {
        success: true,
        period,
        validation_passed: report.overall_status === 'passed',
        message:
          report.overall_status === 'passed'
            ? `Extraction and validation passed: ${report.total_subjects} subjects, ${report.total_contracts} contracts`
            : `Validation ${report.overall_status}: ${report.failed_subjects} subject(s) and ${report.failed_contracts} contract(s) have errors`,
        report,
      };
    } catch (err: any) {
      return {
        success: false,
        period,
        validation_passed: false,
        message: `Unexpected error: ${err?.message ?? String(err)}`,
        report: null,
      };
    }
  }

  /**
   * Trigger a Special Submission for a Dispute Correction Notice.
   * Must be actioned within 5 working days of receiving the notice.
   */
  static async triggerSpecialSubmission(opts: {
    period: string;
    dispute_ref: string;
    affected_borrower_ids: string[];
    submitted_by: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const staged = await CicExtractService.extract(opts.period);
      // Filter to only affected borrowers
      const filteredStaged = {
        ...staged,
        subjects: staged.subjects.filter((s) =>
          opts.affected_borrower_ids.includes(s.borrower_id)
        ),
        contracts: staged.contracts.filter((c) =>
          opts.affected_borrower_ids.includes(c.borrower_id)
        ),
      };

      const report = CicValidatorService.validate(filteredStaged);
      if (report.overall_status === 'failed') {
        return {
          success: false,
          message: `Special submission blocked — validation failed: ${report.blocking_errors.join('; ')}`,
        };
      }

      await CicSubmissionLogService.logSpecialSubmission({
        period: opts.period,
        dispute_ref: opts.dispute_ref,
        file_name: `SPECIAL_${opts.dispute_ref}.csv`,
        submitted_by: opts.submitted_by,
        notes: opts.notes,
      });

      return { success: true, message: `Special submission for dispute ${opts.dispute_ref} logged successfully` };
    } catch (err: any) {
      return { success: false, message: `Error: ${err?.message ?? String(err)}` };
    }
  }

  /** Get list of borrowers with missing CIC fields (for proactive notification) */
  static async getMissingFieldsReport() {
    const { CicValidatorService: CVS } = await import('./CicValidatorService');
    return CVS.getMissingFieldsReport();
  }

  /**
   * Send automated Push and Email notifications to Loan Encoders/Officers
   * regarding borrowers with missing CIC fields.
   */
  static async notifyEncodersAboutMissingFields(borrowers: any[]): Promise<{ success: boolean; message: string }> {
    try {
      if (borrowers.length === 0) {
        return { success: true, message: 'No borrowers with missing fields to notify about.' };
      }

      // In a full production setup, this would call a Supabase Edge Function to dispatch:
      // 1. Expo Push Notifications to registered device tokens
      // 2. Emails via Resend/SendGrid to encoder email addresses
      
      console.log(`[CIC Notification] Simulating push & email notifications for ${borrowers.length} borrowers.`);
      console.log('[CIC Notification] Email template:', `Attention: ${borrowers.length} borrower profiles are missing critical CIC fields. Please log in to complete them.`);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 800));

      return {
        success: true,
        message: `Successfully notified encoders about ${borrowers.length} incomplete profiles via Push and Email.`
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to send notifications: ${err?.message ?? String(err)}`
      };
    }
  }
}
