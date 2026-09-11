import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CicSettingsService, CicSettings } from '../../../src/services/cic/CicSettingsService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2">
      {title}
    </Text>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <View className="mb-1">
      <Text className="text-gray-700 text-xs font-semibold uppercase tracking-wide">{label}</Text>
      {hint ? <Text className="text-gray-400 text-[10px] mt-0.5">{hint}</Text> : null}
    </View>
  );
}

function StyledInput({
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
}) {
  return (
    <TextInput
      className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 mb-4"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
    />
  );
}

// ── Loan Type Map Editor ──────────────────────────────────────────────────────

interface LoanTypeEntry {
  key: string;
  value: string;
}

function LoanTypeMapEditor({
  entries,
  onChange,
}: {
  entries: LoanTypeEntry[];
  onChange: (entries: LoanTypeEntry[]) => void;
}) {
  const addRow = () => onChange([...entries, { key: '', value: '' }]);

  const updateRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, [field]: val } : e));
    onChange(updated);
  };

  const removeRow = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <View>
      {entries.length === 0 && (
        <View className="py-4 items-center bg-gray-50 rounded-xl border border-dashed border-gray-200 mb-3">
          <Text className="text-gray-400 text-xs">No loan type mappings yet.</Text>
        </View>
      )}
      {entries.map((entry, i) => (
        <View key={i} className="flex-row items-center mb-2 gap-x-2">
          <TextInput
            className="flex-1 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-gray-900 text-sm"
            value={entry.key}
            onChangeText={(v) => updateRow(i, 'key', v)}
            placeholder="Loan type name"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
          />
          <TextInput
            className="w-16 border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-gray-900 text-sm text-center"
            value={entry.value}
            onChangeText={(v) => updateRow(i, 'value', v)}
            placeholder="Code"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
          />
          <TouchableOpacity
            onPress={() => removeRow(i)}
            className="w-8 h-8 rounded-full bg-red-50 items-center justify-center"
            activeOpacity={0.7}
          >
            <MaterialIcons name="close" size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity
        onPress={addRow}
        activeOpacity={0.8}
        className="flex-row items-center justify-center border border-dashed border-blue-300 rounded-xl py-2.5 bg-blue-50"
      >
        <MaterialIcons name="add" size={18} color="#1E3A8A" />
        <Text className="text-blue-900 font-semibold text-sm ml-1">Add Mapping</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const CONTRACT_TYPE_HINT: Record<string, string> = {
  '22': '22 = Microfinance loan',
  '1':  '1 = Housing/Real Estate',
  '2':  '2 = Motor Vehicle',
  '3':  '3 = Credit Card',
  '4':  '4 = Personal / Salary loan',
  '5':  '5 = Agricultural / Agri-biz',
};

export default function CicSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Form fields
  const [providerCode, setProviderCode] = useState('');
  const [cooperativeName, setCooperativeName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [defaultContractType, setDefaultContractType] = useState('22');
  const [loanTypeEntries, setLoanTypeEntries] = useState<LoanTypeEntry[]>([]);
  const [extractByDay, setExtractByDay] = useState('3');
  const [validateByDay, setValidateByDay] = useState('5');
  const [submitByDay, setSubmitByDay] = useState('8');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');

  const mark = (setter: (v: any) => void) => (v: any) => {
    setter(v);
    setDirty(true);
  };

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const s = await CicSettingsService.getSettings();
      if (s) {
        setProviderCode(s.provider_code ?? '');
        setCooperativeName(s.cooperative_name ?? '');
        setBranchCode(s.branch_code ?? '');
        setDefaultContractType(String(s.default_contract_type ?? 22));
        setLoanTypeEntries(
          Object.entries(s.loan_type_map ?? {}).map(([key, value]) => ({
            key,
            value: String(value),
          }))
        );
        setExtractByDay(String(s.extract_by_day ?? 3));
        setValidateByDay(String(s.validate_by_day ?? 5));
        setSubmitByDay(String(s.submit_by_day ?? 8));
        setPushEnabled(s.alert_push_enabled ?? false);
        setEmailEnabled(s.alert_email_enabled ?? false);
        setAlertEmail(s.alert_email_address ?? '');
      }
    } catch (err) {
      console.warn('[CicSettings] loadSettings error:', err);
      Alert.alert('Error', 'Failed to load CIC settings.');
    } finally {
      setLoading(false);
      setDirty(false);
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    // Validate days
    const eDay = parseInt(extractByDay, 10);
    const vDay = parseInt(validateByDay, 10);
    const sDay = parseInt(submitByDay, 10);
    if (isNaN(eDay) || isNaN(vDay) || isNaN(sDay) || eDay < 1 || vDay <= eDay || sDay <= vDay || sDay > 28) {
      Alert.alert('Validation Error', 'Days must be in order: Extract < Validate < Submit ≤ 28.');
      return;
    }
    if (!providerCode.trim()) {
      Alert.alert('Validation Error', 'Provider Code is required.');
      return;
    }

    // Build loan_type_map
    const loan_type_map: Record<string, number> = {};
    for (const entry of loanTypeEntries) {
      if (entry.key.trim()) {
        const code = parseInt(entry.value, 10);
        if (!isNaN(code)) loan_type_map[entry.key.trim().toLowerCase()] = code;
      }
    }

    setSaving(true);
    try {
      const success = await CicSettingsService.updateSettings({
        provider_code: providerCode.trim().toUpperCase(),
        cooperative_name: cooperativeName.trim(),
        branch_code: branchCode.trim() || null,
        default_contract_type: parseInt(defaultContractType, 10) || 22,
        loan_type_map,
        extract_by_day: eDay,
        validate_by_day: vDay,
        submit_by_day: sDay,
        alert_push_enabled: pushEnabled,
        alert_email_enabled: emailEnabled,
        alert_email_address: alertEmail.trim() || null,
      });

      if (success) {
        setDirty(false);
        Alert.alert('Saved', 'CIC settings updated successfully.');
      } else {
        Alert.alert('Error', 'Failed to save settings. Check your connection.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Unexpected error.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#1E3A8A" />
        <Text className="mt-3 text-gray-500 text-sm">Loading CIC settings…</Text>
      </View>
    );
  }

  const contractTypeHint = CONTRACT_TYPE_HINT[defaultContractType] ?? `${defaultContractType} = Custom contract type`;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-black text-gray-900">CIC Settings</Text>
          <Text className="text-gray-500 text-sm mt-0.5">Configure your CIC submission profile</Text>
        </View>

        {/* ── Provider Information ── */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <SectionHeader title="Provider Information" />

          <FieldLabel label="Provider Code" hint="Your unique CIC-assigned code (e.g. PF022730)" />
          <StyledInput
            value={providerCode}
            onChangeText={mark(setProviderCode)}
            placeholder="PF022730"
            autoCapitalize="characters"
          />

          <FieldLabel label="Cooperative Name" />
          <StyledInput
            value={cooperativeName}
            onChangeText={mark(setCooperativeName)}
            placeholder="e.g. POS Cursor Multi-Purpose Cooperative"
            autoCapitalize="words"
          />

          <FieldLabel label="Branch Code" hint="Optional — leave blank if single branch" />
          <StyledInput
            value={branchCode}
            onChangeText={mark(setBranchCode)}
            placeholder="Optional"
          />
        </View>

        {/* ── Contract Type ── */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <SectionHeader title="Contract Type" />

          <FieldLabel label="Default Contract Type" hint={contractTypeHint} />
          <StyledInput
            value={defaultContractType}
            onChangeText={mark(setDefaultContractType)}
            placeholder="22"
            keyboardType="numeric"
          />

          <View className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <Text className="text-blue-900 text-[11px] font-semibold mb-1">CIC Domain Codes (common)</Text>
            {Object.entries(CONTRACT_TYPE_HINT).map(([code, desc]) => (
              <Text key={code} className="text-blue-700 text-[10px] leading-5">{desc}</Text>
            ))}
          </View>
        </View>

        {/* ── Loan Type Mappings ── */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <SectionHeader title="Loan Type Mappings" />
          <Text className="text-gray-400 text-[11px] mb-3">
            Map your internal loan type names to CIC contract type codes.
            Falls back to Default Contract Type if not listed.
          </Text>
          <LoanTypeMapEditor
            entries={loanTypeEntries}
            onChange={(e) => { setLoanTypeEntries(e); setDirty(true); }}
          />
        </View>

        {/* ── Internal Deadlines ── */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
          <SectionHeader title="Internal Deadlines (Day of Month)" />

          <View className="flex-row gap-x-3">
            <View className="flex-1">
              <FieldLabel label="Extract By" hint="Day to run extraction" />
              <TextInput
                className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-center font-bold mb-4"
                value={extractByDay}
                onChangeText={mark(setExtractByDay)}
                placeholder="3"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <View className="flex-1">
              <FieldLabel label="Validate By" hint="Day to validate" />
              <TextInput
                className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-center font-bold mb-4"
                value={validateByDay}
                onChangeText={mark(setValidateByDay)}
                placeholder="5"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <View className="flex-1">
              <FieldLabel label="Submit By" hint="Day to submit" />
              <TextInput
                className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-900 text-center font-bold mb-4"
                value={submitByDay}
                onChangeText={mark(setSubmitByDay)}
                placeholder="8"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          </View>

          <View className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <Text className="text-gray-400 text-[11px] leading-4">
              The dashboard banner turns yellow within 2 days of the Submit deadline and red when overdue.
              These are internal reminders only — CIC's official deadline is the 8th of each month.
            </Text>
          </View>
        </View>

        {/* ── Alert Settings ── */}
        <View className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
          <SectionHeader title="Alert Settings" />

          <View className="flex-row items-center justify-between py-3 border-b border-gray-50">
            <View className="flex-1 pr-4">
              <Text className="text-gray-900 font-semibold text-sm">Push Notifications</Text>
              <Text className="text-gray-400 text-[11px] mt-0.5">Receive deadline reminders on this device</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={mark(setPushEnabled)}
              trackColor={{ true: '#1E3A8A' }}
            />
          </View>

          <View className="flex-row items-center justify-between py-3 border-b border-gray-50">
            <View className="flex-1 pr-4">
              <Text className="text-gray-900 font-semibold text-sm">Email Alerts</Text>
              <Text className="text-gray-400 text-[11px] mt-0.5">Send deadline reminders to an email address</Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={mark(setEmailEnabled)}
              trackColor={{ true: '#1E3A8A' }}
            />
          </View>

          {emailEnabled && (
            <View className="mt-3">
              <FieldLabel label="Alert Email Address" />
              <TextInput
                className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-3 text-gray-900"
                value={alertEmail}
                onChangeText={mark(setAlertEmail)}
                placeholder="admin@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}
        </View>

        {/* ── Save Button ── */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !dirty}
          activeOpacity={0.8}
          className={`rounded-2xl py-4 items-center flex-row justify-center shadow-sm ${
            saving ? 'bg-gray-200' : dirty ? 'bg-blue-900' : 'bg-gray-200'
          }`}
        >
          {saving
            ? <ActivityIndicator color="#9CA3AF" />
            : (
              <>
                <MaterialIcons
                  name="save"
                  size={20}
                  color={dirty ? 'white' : '#9CA3AF'}
                  style={{ marginRight: 8 }}
                />
                <Text className={`font-bold uppercase tracking-wider ${dirty ? 'text-white' : 'text-gray-400'}`}>
                  {dirty ? 'Save Settings' : 'No Changes'}
                </Text>
              </>
            )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
