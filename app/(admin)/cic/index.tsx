import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
  RefreshControl,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../src/store/AuthContext';
import { CicSchedulerService, CicDeadlineStatus } from '../../../src/services/cic/CicSchedulerService';

// ── Types ────────────────────────────────────────────────────────────────────

interface MissingFieldsRow {
  borrower_id: string;
  borrower_name: string;
  membership_number: string;
  missing_fields: string[];
}

interface SubmissionLogRow {
  id: string;
  period: string;
  submission_type: 'regular' | 'special';
  status: 'draft' | 'validated' | 'submitted' | 'accepted' | 'rejected';
  record_count: number;
  submitted_at: string | null;
  file_name: string | null;
  notes: string | null;
}

// ── Helper components ────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: keyof typeof MaterialIcons.glyphMap; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <View className="flex-row items-center mb-3">
        <MaterialIcons name={icon} size={18} color="#1E3A8A" style={{ marginRight: 6 }} />
        <Text className="text-gray-900 font-bold text-base uppercase tracking-wider">{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StatusBadge({ status }: { status: SubmissionLogRow['status'] }) {
  const cfg: Record<SubmissionLogRow['status'], { bg: string; text: string; label: string }> = {
    draft:     { bg: 'bg-gray-200',   text: 'text-gray-700',  label: 'Draft' },
    validated: { bg: 'bg-blue-100',   text: 'text-blue-800',  label: 'Validated' },
    submitted: { bg: 'bg-yellow-100', text: 'text-yellow-800',label: 'Submitted' },
    accepted:  { bg: 'bg-green-100',  text: 'text-green-800', label: 'Accepted' },
    rejected:  { bg: 'bg-red-100',    text: 'text-red-800',   label: 'Rejected' },
  };
  const c = cfg[status] ?? cfg.draft;
  return (
    <View className={`px-2 py-0.5 rounded-full ${c.bg}`}>
      <Text className={`text-[10px] font-bold uppercase tracking-wide ${c.text}`}>{c.label}</Text>
    </View>
  );
}

function CheckStep({ label, done }: { label: string; done: boolean }) {
  return (
    <View className="flex-row items-center mr-5">
      <View className={`w-5 h-5 rounded-full items-center justify-center mr-1.5 ${done ? 'bg-white' : 'bg-white/20'}`}>
        {done && <MaterialIcons name="check" size={13} color="#16A34A" />}
      </View>
      <Text className={`text-xs font-semibold ${done ? 'text-white' : 'text-white/60'}`}>{label}</Text>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function CicDashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [deadlineStatus, setDeadlineStatus] = useState<CicDeadlineStatus | null>(null);
  const [missingFields, setMissingFields] = useState<MissingFieldsRow[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Manual submission modal state
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [manualPeriod, setManualPeriod] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [deadline, missing] = await Promise.all([
        CicSchedulerService.getDeadlineStatus().catch(() => null),
        CicSchedulerService.getMissingFieldsReport().catch(() => []),
      ]);

      setDeadlineStatus(deadline);
      setMissingFields(Array.isArray(missing) ? missing : []);

      // Load submission history — service may not exist yet, gracefully fail
      try {
        const { CicSubmissionLogService } = await import('../../../src/services/cic/CicSubmissionLogService' as any);
        const history = await CicSubmissionLogService.getHistory();
        setSubmissionHistory(Array.isArray(history) ? history : []);
      } catch {
        setSubmissionHistory([]);
      }
    } catch (err) {
      console.warn('[CicDashboard] loadData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const handleRunExtraction = async () => {
    const confirm = () => new Promise<boolean>((resolve) => {
      if (Platform.OS === 'web') {
        resolve(window.confirm('Run monthly CIC extraction for the previous month?'));
      } else {
        Alert.alert('Run Extraction', 'Extract and validate CIC data for the previous month?', [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Run', onPress: () => resolve(true) },
        ]);
      }
    });

    if (!(await confirm())) return;

    setExtracting(true);
    try {
      const result = await CicSchedulerService.runMonthlyExtraction(user?.email ?? 'admin');
      if (result.success) {
        Alert.alert('Extraction Complete', result.message);
        if (result.report) {
          router.push({
            pathname: '/(admin)/cic/validation-report' as any,
            params: { report: JSON.stringify(result.report) },
          });
        }
        loadData();
      } else {
        Alert.alert('Extraction Failed', result.message);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unexpected error during extraction.');
    } finally {
      setExtracting(false);
    }
  };

  const handleLogManualSubmission = async () => {
    if (!manualPeriod.trim()) {
      Alert.alert('Validation', 'Period is required (e.g. 2025-06).');
      return;
    }
    setManualSubmitting(true);
    try {
      const { CicSubmissionLogService } = await import('../../../src/services/cic/CicSubmissionLogService' as any);
      await CicSubmissionLogService.logManualSubmission({
        period: manualPeriod.trim(),
        submitted_by: user?.email ?? 'admin',
        notes: manualNotes.trim() || null,
      });
      setManualModalVisible(false);
      setManualPeriod('');
      setManualNotes('');
      Alert.alert('Logged', 'Manual submission recorded.');
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Failed to log submission.');
    } finally {
      setManualSubmitting(false);
    }
  };

  // ── Deadline banner color ─────────────────────────────────────────────────

  const bannerColor = deadlineStatus?.is_overdue
    ? 'bg-red-600'
    : deadlineStatus?.days_until_submit !== undefined && deadlineStatus.days_until_submit <= 2
    ? 'bg-yellow-500'
    : 'bg-green-600';

  const bannerCountdown = deadlineStatus
    ? deadlineStatus.is_overdue
      ? `${Math.abs(deadlineStatus.days_until_submit)}d overdue`
      : `${deadlineStatus.days_until_submit}d left to submit`
    : '—';

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text className="mt-3 text-gray-500 text-sm">Loading CIC dashboard…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── Page Title ── */}
        <View className="mb-5">
          <Text className="text-2xl font-black text-gray-900">CIC Reporting</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Credit Information Corporation Submission Center</Text>
        </View>

        {/* ── 1. Deadline Status Banner ── */}
        <View className={`rounded-2xl p-4 mb-6 shadow-sm ${bannerColor}`}>
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-white/80 text-[10px] font-bold uppercase tracking-widest">Current Period</Text>
              <Text className="text-white text-xl font-black">{deadlineStatus?.period ?? '—'}</Text>
            </View>
            <View className="bg-white/20 rounded-xl px-3 py-1.5 items-center">
              <MaterialIcons name="schedule" size={18} color="white" />
              <Text className="text-white text-xs font-bold mt-0.5">{bannerCountdown}</Text>
            </View>
          </View>

          <View className="flex-row flex-wrap">
            <CheckStep label={`Extract (by day ${deadlineStatus?.extract_by_day ?? 3})`} done={deadlineStatus?.extraction_done ?? false} />
            <CheckStep label={`Validate (by day ${deadlineStatus?.validate_by_day ?? 5})`} done={deadlineStatus?.validation_done ?? false} />
            <CheckStep label={`Submit (by day ${deadlineStatus?.submit_by_day ?? 8})`} done={deadlineStatus?.submission_done ?? false} />
          </View>

          {deadlineStatus?.alert_message ? (
            <View className="mt-3 bg-white/20 rounded-xl p-2.5">
              <Text className="text-white text-xs font-semibold">{deadlineStatus.alert_message}</Text>
            </View>
          ) : null}
        </View>

        {/* ── 2. Data Quality Panel ── */}
        <Section title="Data Quality" icon="fact-check">
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
              <Text className="text-gray-700 text-sm font-semibold">Borrowers with Missing CIC Fields</Text>
              <View className={`px-2.5 py-0.5 rounded-full ${missingFields.length > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                <Text className={`text-xs font-bold ${missingFields.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {missingFields.length}
                </Text>
              </View>
            </View>

            {missingFields.length === 0 ? (
              <View className="p-6 items-center">
                <MaterialIcons name="check-circle" size={32} color="#16A34A" />
                <Text className="text-green-700 font-semibold mt-2">All fields complete</Text>
                <Text className="text-gray-400 text-xs mt-0.5">No borrowers are missing required CIC fields.</Text>
              </View>
            ) : (
              <>
                {missingFields.slice(0, 8).map((row, i) => (
                  <View key={row.borrower_id ?? i} className={`px-4 py-3 ${i < missingFields.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-900 font-semibold text-sm flex-1 mr-2" numberOfLines={1}>{row.borrower_name}</Text>
                      <Text className="text-gray-400 text-[10px]">#{row.membership_number}</Text>
                    </View>
                    <View className="flex-row flex-wrap gap-1">
                      {(row.missing_fields ?? []).map((field) => (
                        <View key={field} className="bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                          <Text className="text-red-600 text-[10px] font-medium">{field}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
                {missingFields.length > 8 && (
                  <View className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <Text className="text-gray-500 text-xs text-center">+{missingFields.length - 8} more borrowers</Text>
                  </View>
                )}
                <View className="p-3 bg-gray-50 border-t border-gray-100">
                  <Pressable 
                    onPress={() => router.push('/(admin)/cic/missing-fields')}
                    className="bg-blue-100 py-2.5 rounded-xl flex-row items-center justify-center active:bg-blue-200"
                  >
                    <MaterialIcons name="notifications-active" size={16} color="#1D4ED8" className="mr-2" />
                    <Text className="text-blue-800 font-bold text-xs uppercase tracking-wider">View All & Notify Encoders</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Section>

        {/* ── 3. Submission History ── */}
        <Section title="Submission History" icon="history">
          <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {submissionHistory.length === 0 ? (
              <View className="p-6 items-center">
                <MaterialIcons name="inbox" size={32} color="#9CA3AF" />
                <Text className="text-gray-400 font-medium mt-2">No submissions yet</Text>
              </View>
            ) : (
              submissionHistory.slice(0, 10).map((log, i) => (
                <View key={log.id ?? i} className={`px-4 py-3 flex-row items-center ${i < submissionHistory.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                      <Text className="text-gray-900 font-bold text-sm">{log.period}</Text>
                      <View className="bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                        <Text className="text-blue-600 text-[10px] font-medium capitalize">{log.submission_type}</Text>
                      </View>
                    </View>
                    <Text className="text-gray-400 text-[11px]">
                      {log.record_count ?? 0} records{log.submitted_at ? ` · ${new Date(log.submitted_at).toLocaleDateString('en-PH')}` : ''}
                    </Text>
                  </View>
                  <StatusBadge status={log.status} />
                </View>
              ))
            )}
          </View>
        </Section>

        {/* ── 4. Action Buttons ── */}
        <Section title="Actions" icon="bolt">
          <View className="gap-y-3">
            {/* Run Monthly Extraction */}
            <TouchableOpacity
              onPress={handleRunExtraction}
              disabled={extracting}
              activeOpacity={0.8}
              className={`rounded-2xl flex-row items-center p-4 shadow-sm ${extracting ? 'bg-gray-200' : 'bg-blue-900'}`}
            >
              {extracting
                ? <ActivityIndicator color="#6B7280" size="small" style={{ marginRight: 10 }} />
                : <MaterialIcons name="play-arrow" size={22} color="white" style={{ marginRight: 10 }} />}
              <View className="flex-1">
                <Text className={`font-bold text-sm ${extracting ? 'text-gray-500' : 'text-white'}`}>Run Monthly Extraction</Text>
                <Text className={`text-[11px] mt-0.5 ${extracting ? 'text-gray-400' : 'text-blue-200'}`}>Extract + validate data for previous month</Text>
              </View>
              {!extracting && <MaterialIcons name="arrow-forward-ios" size={14} color="rgba(255,255,255,0.5)" />}
            </TouchableOpacity>

            {/* Generate Regular File */}
            <TouchableOpacity
              onPress={() => router.push('/(admin)/cic/generate' as any)}
              activeOpacity={0.8}
              className="rounded-2xl flex-row items-center p-4 bg-white border border-gray-200 shadow-sm"
            >
              <MaterialIcons name="description" size={22} color="#1E3A8A" style={{ marginRight: 10 }} />
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-sm">Generate Regular File</Text>
                <Text className="text-gray-500 text-[11px] mt-0.5">Build the monthly CIC submission CSV</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Log Manual Submission */}
            <TouchableOpacity
              onPress={() => setManualModalVisible(true)}
              activeOpacity={0.8}
              className="rounded-2xl flex-row items-center p-4 bg-white border border-gray-200 shadow-sm"
            >
              <MaterialIcons name="how-to-reg" size={22} color="#1E3A8A" style={{ marginRight: 10 }} />
              <View className="flex-1">
                <Text className="text-gray-900 font-bold text-sm">Log Manual Submission</Text>
                <Text className="text-gray-500 text-[11px] mt-0.5">Record a submission made via CIC portal</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Trigger Special Submission */}
            <TouchableOpacity
              onPress={() => router.push('/(admin)/cic/special-submission' as any)}
              activeOpacity={0.8}
              className="rounded-2xl flex-row items-center p-4 bg-amber-50 border border-amber-200 shadow-sm"
            >
              <MaterialIcons name="report-problem" size={22} color="#B45309" style={{ marginRight: 10 }} />
              <View className="flex-1">
                <Text className="text-amber-900 font-bold text-sm">Trigger Special Submission</Text>
                <Text className="text-amber-700 text-[11px] mt-0.5">Dispute correction or off-cycle filing</Text>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#B45309" />
            </TouchableOpacity>

            {/* Settings shortcut */}
            <TouchableOpacity
              onPress={() => router.push('/(admin)/cic/settings' as any)}
              activeOpacity={0.8}
              className="rounded-2xl flex-row items-center p-4 bg-gray-100 border border-gray-200"
            >
              <MaterialIcons name="settings" size={20} color="#374151" style={{ marginRight: 10 }} />
              <Text className="text-gray-700 font-semibold text-sm flex-1">CIC Settings</Text>
              <MaterialIcons name="arrow-forward-ios" size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Section>
      </ScrollView>

      {/* ── Manual Submission Modal ── */}
      <Modal
        visible={manualModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setManualModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-gray-900 text-lg font-black">Log Manual Submission</Text>
              <TouchableOpacity onPress={() => setManualModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text className="text-gray-700 text-xs font-semibold mb-1 uppercase tracking-wide">Period (YYYY-MM)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-4 bg-gray-50"
              placeholder="e.g. 2025-06"
              placeholderTextColor="#9CA3AF"
              value={manualPeriod}
              onChangeText={setManualPeriod}
              autoCapitalize="none"
            />

            <Text className="text-gray-700 text-xs font-semibold mb-1 uppercase tracking-wide">Notes (optional)</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-900 mb-6 bg-gray-50"
              placeholder="e.g. Submitted by Juan via portal at 2:00 PM"
              placeholderTextColor="#9CA3AF"
              value={manualNotes}
              onChangeText={setManualNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <TouchableOpacity
              onPress={handleLogManualSubmission}
              disabled={manualSubmitting}
              activeOpacity={0.8}
              className={`rounded-xl py-4 items-center ${manualSubmitting ? 'bg-gray-200' : 'bg-blue-900'}`}
            >
              {manualSubmitting
                ? <ActivityIndicator color="#9CA3AF" />
                : <Text className="text-white font-bold uppercase tracking-wider">Log Submission</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
