import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ── Types (mirror CicValidatorService output) ─────────────────────────────────

export interface SubjectError {
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SubjectResult {
  borrower_id: string;
  borrower_name: string;
  membership_number: string;
  status: 'passed' | 'failed' | 'warning';
  errors: SubjectError[];
}

export interface ContractResult {
  borrower_id: string;
  borrower_name: string;
  loan_id: string;
  status: 'passed' | 'failed' | 'warning';
  errors: SubjectError[];
}

export interface CicValidationReport {
  period: string;
  overall_status: 'passed' | 'warning' | 'failed';
  total_subjects: number;
  failed_subjects: number;
  total_contracts: number;
  failed_contracts: number;
  blocking_errors: string[];
  subjects: SubjectResult[];
  contracts: ContractResult[];
}

// ── Helper components ─────────────────────────────────────────────────────────

function OverallBadge({ status }: { status: CicValidationReport['overall_status'] }) {
  const cfg = {
    passed:  { bg: 'bg-green-100',  text: 'text-green-800',  icon: 'check-circle' as const,  label: 'PASSED' },
    warning: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: 'warning' as const,        label: 'WARNING' },
    failed:  { bg: 'bg-red-100',    text: 'text-red-800',    icon: 'cancel' as const,         label: 'FAILED' },
  };
  const c = cfg[status] ?? cfg.warning;
  return (
    <View className={`flex-row items-center px-4 py-2 rounded-full ${c.bg}`}>
      <MaterialIcons name={c.icon} size={18} color={c.text.replace('text-', '')} style={{ marginRight: 6 }} />
      <Text className={`font-black text-sm tracking-wider ${c.text}`}>{c.label}</Text>
    </View>
  );
}

function SeverityIcon({ severity }: { severity: 'error' | 'warning' }) {
  return severity === 'error'
    ? <MaterialIcons name="error" size={14} color="#DC2626" style={{ marginRight: 5, marginTop: 1 }} />
    : <MaterialIcons name="warning" size={14} color="#D97706" style={{ marginRight: 5, marginTop: 1 }} />;
}

function ExpandableRow({
  title,
  subtitle,
  status,
  errors,
}: {
  title: string;
  subtitle: string;
  status: 'passed' | 'failed' | 'warning';
  errors: SubjectError[];
}) {
  const [open, setOpen] = useState(false);
  const hasIssues = errors.length > 0;
  const statusColor = status === 'passed' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : 'text-yellow-600';
  const dotColor = status === 'passed' ? 'bg-green-500' : status === 'failed' ? 'bg-red-500' : 'bg-yellow-500';

  return (
    <View className="border-b border-gray-50 last:border-b-0">
      <TouchableOpacity
        onPress={() => hasIssues && setOpen((o) => !o)}
        activeOpacity={hasIssues ? 0.7 : 1}
        className="flex-row items-center px-4 py-3"
      >
        <View className={`w-2 h-2 rounded-full ${dotColor} mr-3`} />
        <View className="flex-1">
          <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{title}</Text>
          <Text className="text-gray-400 text-[11px]">{subtitle}</Text>
        </View>
        {hasIssues ? (
          <View className="flex-row items-center">
            <View className="bg-red-50 border border-red-100 rounded-full px-2 py-0.5 mr-2">
              <Text className="text-red-600 text-[10px] font-bold">{errors.length} issue{errors.length > 1 ? 's' : ''}</Text>
            </View>
            <MaterialIcons
              name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={20}
              color="#9CA3AF"
            />
          </View>
        ) : (
          <MaterialIcons name="check-circle" size={18} color="#16A34A" />
        )}
      </TouchableOpacity>

      {open && hasIssues && (
        <View className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
          {errors.map((e, i) => (
            <View key={i} className="flex-row items-start mt-2">
              <SeverityIcon severity={e.severity} />
              <View className="flex-1">
                {e.field ? (
                  <Text className="text-gray-500 text-[10px] uppercase tracking-wide mb-0.5">{e.field}</Text>
                ) : null}
                <Text className={`text-xs font-medium leading-4 ${e.severity === 'error' ? 'text-red-700' : 'text-yellow-700'}`}>
                  {e.message}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <View className={`flex-1 rounded-xl p-3 items-center ${highlight ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
      <Text className={`text-2xl font-black ${highlight ? 'text-red-600' : 'text-gray-900'}`}>{value}</Text>
      <Text className={`text-[10px] font-semibold mt-0.5 text-center ${highlight ? 'text-red-500' : 'text-gray-500'}`}>{label}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const EMPTY_REPORT: CicValidationReport = {
  period: '—',
  overall_status: 'warning',
  total_subjects: 0,
  failed_subjects: 0,
  total_contracts: 0,
  failed_contracts: 0,
  blocking_errors: [],
  subjects: [],
  contracts: [],
};

export default function CicValidationReportScreen() {
  const params = useLocalSearchParams<{ report?: string }>();
  const router = useRouter();

  const report: CicValidationReport = useMemo(() => {
    if (!params.report) return EMPTY_REPORT;
    try {
      return JSON.parse(params.report) as CicValidationReport;
    } catch {
      return EMPTY_REPORT;
    }
  }, [params.report]);

  const [subjectFilter, setSubjectFilter] = useState<'all' | 'issues'>('issues');
  const [contractFilter, setContractFilter] = useState<'all' | 'issues'>('issues');

  const filteredSubjects = subjectFilter === 'issues'
    ? report.subjects.filter((s) => s.status !== 'passed')
    : report.subjects;

  const filteredContracts = contractFilter === 'issues'
    ? report.contracts.filter((c) => c.status !== 'passed')
    : report.contracts;

  const handleShare = async () => {
    const lines: string[] = [
      `CIC Validation Report — Period: ${report.period}`,
      `Overall Status: ${report.overall_status.toUpperCase()}`,
      `Subjects: ${report.total_subjects} total, ${report.failed_subjects} failed`,
      `Contracts: ${report.total_contracts} total, ${report.failed_contracts} failed`,
      '',
    ];

    if (report.blocking_errors.length > 0) {
      lines.push('── BLOCKING ERRORS ──');
      report.blocking_errors.forEach((e) => lines.push(`  • ${e}`));
      lines.push('');
    }

    const failedSubjects = report.subjects.filter((s) => s.status !== 'passed');
    if (failedSubjects.length > 0) {
      lines.push('── SUBJECT ISSUES ──');
      failedSubjects.forEach((s) => {
        lines.push(`${s.borrower_name} (#${s.membership_number})`);
        s.errors.forEach((e) => lines.push(`  [${e.severity.toUpperCase()}] ${e.field ? e.field + ': ' : ''}${e.message}`));
      });
      lines.push('');
    }

    const failedContracts = report.contracts.filter((c) => c.status !== 'passed');
    if (failedContracts.length > 0) {
      lines.push('── CONTRACT ISSUES ──');
      failedContracts.forEach((c) => {
        lines.push(`${c.borrower_name} — Loan #${c.loan_id}`);
        c.errors.forEach((e) => lines.push(`  [${e.severity.toUpperCase()}] ${e.field ? e.field + ': ' : ''}${e.message}`));
      });
    }

    const text = lines.join('\n');

    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(text);
        Alert.alert('Copied', 'Report copied to clipboard.');
      } else {
        await Share.share({ message: text, title: `CIC Validation Report ${report.period}` });
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not share report.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      className="flex-1 bg-gray-50"
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      {/* Header */}
      <View className="flex-row items-start justify-between mb-5">
        <View className="flex-1 mr-3">
          <Text className="text-2xl font-black text-gray-900">Validation Report</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Period: {report.period}</Text>
        </View>
        <View className="items-end gap-y-2">
          <OverallBadge status={report.overall_status} />
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.8}
            className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-1.5"
          >
            <MaterialIcons name="share" size={16} color="#374151" style={{ marginRight: 5 }} />
            <Text className="text-gray-700 text-xs font-semibold">Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Summary Stats ── */}
      <View className="mb-5">
        <View className="flex-row gap-x-2 mb-2">
          <StatCard label="Total Subjects" value={report.total_subjects} />
          <StatCard label="Failed Subjects" value={report.failed_subjects} highlight={report.failed_subjects > 0} />
        </View>
        <View className="flex-row gap-x-2">
          <StatCard label="Total Contracts" value={report.total_contracts} />
          <StatCard label="Failed Contracts" value={report.failed_contracts} highlight={report.failed_contracts > 0} />
        </View>
      </View>

      {/* ── Blocking Errors ── */}
      {report.blocking_errors.length > 0 && (
        <View className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
          <View className="flex-row items-center mb-3">
            <MaterialIcons name="block" size={20} color="#DC2626" style={{ marginRight: 8 }} />
            <Text className="text-red-800 font-black text-base">Blocking Errors</Text>
            <View className="ml-2 bg-red-600 rounded-full px-2 py-0.5">
              <Text className="text-white text-[10px] font-bold">{report.blocking_errors.length}</Text>
            </View>
          </View>
          <Text className="text-red-700 text-[11px] mb-3 leading-4">
            These errors must be resolved before the file can be submitted to CIC.
          </Text>
          {report.blocking_errors.map((err, i) => (
            <View key={i} className="flex-row items-start mb-2">
              <MaterialIcons name="error" size={14} color="#DC2626" style={{ marginRight: 6, marginTop: 1 }} />
              <Text className="text-red-800 text-xs font-medium flex-1 leading-4">{err}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Subject List ── */}
      <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="flex-row items-center">
            <MaterialIcons name="people" size={18} color="#1E3A8A" style={{ marginRight: 6 }} />
            <Text className="text-gray-900 font-bold text-sm">Subjects</Text>
            <View className="ml-2 bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-gray-600 text-[10px] font-bold">{report.total_subjects}</Text>
            </View>
          </View>
          <View className="flex-row bg-gray-100 rounded-lg overflow-hidden">
            {(['issues', 'all'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setSubjectFilter(f)}
                activeOpacity={0.8}
                className={`px-3 py-1.5 ${subjectFilter === f ? 'bg-blue-900' : ''}`}
              >
                <Text className={`text-[11px] font-semibold capitalize ${subjectFilter === f ? 'text-white' : 'text-gray-500'}`}>
                  {f === 'issues' ? 'Issues' : 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filteredSubjects.length === 0 ? (
          <View className="p-6 items-center">
            <MaterialIcons name="check-circle" size={32} color="#16A34A" />
            <Text className="text-green-700 font-semibold mt-2">
              {subjectFilter === 'issues' ? 'No subject issues found' : 'No subjects in report'}
            </Text>
          </View>
        ) : (
          filteredSubjects.map((subject, i) => (
            <ExpandableRow
              key={subject.borrower_id ?? i}
              title={subject.borrower_name}
              subtitle={`Member #${subject.membership_number}`}
              status={subject.status}
              errors={subject.errors}
            />
          ))
        )}
      </View>

      {/* ── Contract List ── */}
      <View className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <View className="flex-row items-center">
            <MaterialIcons name="receipt-long" size={18} color="#1E3A8A" style={{ marginRight: 6 }} />
            <Text className="text-gray-900 font-bold text-sm">Contracts</Text>
            <View className="ml-2 bg-gray-100 rounded-full px-2 py-0.5">
              <Text className="text-gray-600 text-[10px] font-bold">{report.total_contracts}</Text>
            </View>
          </View>
          <View className="flex-row bg-gray-100 rounded-lg overflow-hidden">
            {(['issues', 'all'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setContractFilter(f)}
                activeOpacity={0.8}
                className={`px-3 py-1.5 ${contractFilter === f ? 'bg-blue-900' : ''}`}
              >
                <Text className={`text-[11px] font-semibold capitalize ${contractFilter === f ? 'text-white' : 'text-gray-500'}`}>
                  {f === 'issues' ? 'Issues' : 'All'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {filteredContracts.length === 0 ? (
          <View className="p-6 items-center">
            <MaterialIcons name="check-circle" size={32} color="#16A34A" />
            <Text className="text-green-700 font-semibold mt-2">
              {contractFilter === 'issues' ? 'No contract issues found' : 'No contracts in report'}
            </Text>
          </View>
        ) : (
          filteredContracts.map((contract, i) => (
            <ExpandableRow
              key={`${contract.borrower_id}-${contract.loan_id}-${i}`}
              title={contract.borrower_name}
              subtitle={`Loan #${contract.loan_id}`}
              status={contract.status}
              errors={contract.errors}
            />
          ))
        )}
      </View>

      {/* Bottom Export Button */}
      <TouchableOpacity
        onPress={handleShare}
        activeOpacity={0.8}
        className="rounded-2xl py-4 items-center flex-row justify-center bg-blue-900 shadow-sm"
      >
        <MaterialIcons name="share" size={20} color="white" style={{ marginRight: 8 }} />
        <Text className="text-white font-bold uppercase tracking-wider">Share Full Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
