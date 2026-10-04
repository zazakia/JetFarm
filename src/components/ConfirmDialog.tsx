import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
  isDangerous?: boolean;
  /**
   * 'confirm' (default) renders Cancel + Confirm.
   * 'alert' renders a single acknowledgment button — used for informational
   * messages, because `Alert.alert` is a no-op on react-native-web.
   */
  mode?: 'confirm' | 'alert';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  isDestructive,
  isDangerous,
  mode = 'confirm',
}) => {
  const isAlert = mode === 'alert';
  const destructive = isAlert ? false : (isDestructive ?? isDangerous ?? true);
  const resolvedConfirmLabel =
    confirmLabel ?? confirmText ?? (isAlert ? 'OK' : 'Confirm');
  const resolvedCancelLabel = cancelLabel ?? cancelText ?? 'Cancel';
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay} testID="confirm-dialog">
        <BlurView intensity={20} style={StyleSheet.absoluteFill} />
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={[styles.iconContainer, destructive && styles.destructiveIcon]}>
              <Ionicons
                name={destructive ? "alert-circle" : "information-circle"}
                size={32}
                color={destructive ? "#EF4444" : "#3B82F6"}
              />
            </View>
            <Text style={styles.title} testID="confirm-dialog-title">{title}</Text>
          </View>

          <Text style={styles.message} testID="confirm-dialog-message">{message}</Text>

          <View style={styles.footer}>
            {!isAlert && (
              <TouchableOpacity
                style={styles.button}
                onPress={onCancel}
                testID="confirm-dialog-cancel"
              >
                <Text style={styles.cancelText}>{resolvedCancelLabel}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.confirmButton, destructive && styles.destructiveButton]}
              onPress={isAlert ? onCancel : onConfirm}
              testID="confirm-dialog-confirm"
            >
              <Text style={styles.confirmText}>{resolvedConfirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: Dimensions.get('window').width * 0.85,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 10px 0 rgba(0, 0, 0, 0.1)',
      },
      default: {
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  destructiveIcon: {
    backgroundColor: '#FEF2F2',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  message: {
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
  },
  destructiveButton: {
    backgroundColor: '#EF4444',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default ConfirmDialog;
