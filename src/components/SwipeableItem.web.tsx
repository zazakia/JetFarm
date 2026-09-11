import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onActionsVisibilityChange?: (isVisible: boolean) => void;
  renderRightActions?: (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => React.ReactNode;
}

/**
 * Web version of SwipeableItem.
 * On web there are no swipe gestures and react-native-gesture-handler's
 * Swipeable triggers a `useNativeDriver` warning because the native
 * animated module is not available in react-native-web.
 *
 * Instead we show Edit / Delete action buttons inline on the right side,
 * which is a much better UX for mouse/keyboard users.
 */
const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onEdit,
  onDelete,
  onActionsVisibilityChange,
}) => {
  const { width } = useWindowDimensions();
  const isCompact = width < 480;
  const hasActions = onEdit || onDelete;

  return (
    <View style={[styles.row, isCompact && styles.compactRow]}>
      <View style={styles.contentContainer}>{children}</View>
      {hasActions && (
        <View style={[styles.actionsContainer, isCompact && styles.compactActionsContainer]}>
          {onEdit && (
            <TouchableOpacity
              style={[styles.actionButton, isCompact && styles.compactActionButton, styles.editButton]}
              onPress={() => {
                onActionsVisibilityChange?.(false);
                onEdit();
              }}
            >
              <Ionicons name="pencil" size={18} color="white" />
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={[styles.actionButton, isCompact && styles.compactActionButton, styles.deleteButton]}
              onPress={() => {
                onActionsVisibilityChange?.(false);
                onDelete();
              }}
            >
              <Ionicons name="trash" size={18} color="white" />
              <Text style={styles.actionText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'white',
  },
  compactRow: {
    flexDirection: 'column',
  },
  contentContainer: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'white',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactActionsContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 4,
    minWidth: 64,
    alignSelf: 'stretch',
  },
  compactActionButton: {
    flex: 1,
    minHeight: 44,
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default SwipeableItem;
