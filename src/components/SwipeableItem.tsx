import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

interface SwipeableItemProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onActionsVisibilityChange?: (isVisible: boolean) => void;
  renderRightActions?: (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => React.ReactNode;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onEdit,
  onDelete,
  onActionsVisibilityChange,
  renderRightActions,
}) => {
  const defaultRenderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    return (
      <View style={styles.rightActionsContainer}>
        {onEdit && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]} 
            onPress={() => {
              onActionsVisibilityChange?.(false);
              onEdit();
            }}
          >
            <Ionicons name="pencil" size={24} color="white" />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]} 
            onPress={() => {
              onActionsVisibilityChange?.(false);
              onDelete();
            }}
          >
            <Ionicons name="trash" size={24} color="white" />
            <Text style={styles.actionText}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions || defaultRenderRightActions}
      onSwipeableOpen={() => onActionsVisibilityChange?.(true)}
      onSwipeableClose={() => onActionsVisibilityChange?.(false)}
      friction={2}
      leftThreshold={30}
      rightThreshold={40}
    >
      <View style={styles.contentContainer}>
        {children}
      </View>
    </Swipeable>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    backgroundColor: 'white',
  },
  rightActionsContainer: {
    flexDirection: 'row',
    width: 132,
  },
  actionButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});

export default SwipeableItem;
