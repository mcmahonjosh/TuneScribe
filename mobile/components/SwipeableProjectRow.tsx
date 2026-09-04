import { useRef } from 'react';
import {
  Alert,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ProjectCard from '@/components/ProjectCard';
import { useTheme } from '@/context/ThemeContext';
import { Project } from '@/types/project';

const DELETE_WIDTH = 80;

interface SwipeableProjectRowProps {
  project: Project;
  onPress: () => void;
  onDelete: (project: Project) => void;
}

export default function SwipeableProjectRow({
  project,
  onPress,
  onDelete,
}: SwipeableProjectRowProps) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const dragStartX = useRef(0);

  function closeRow() {
    dragStartX.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }

  function openRow() {
    dragStartX.current = -DELETE_WIDTH;
    Animated.spring(translateX, {
      toValue: -DELETE_WIDTH,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        translateX.stopAnimation((value) => {
          dragStartX.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const next = Math.max(-DELETE_WIDTH, Math.min(0, dragStartX.current + gesture.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const next = dragStartX.current + gesture.dx;
        if (next < -DELETE_WIDTH / 2 || gesture.vx < -0.4) {
          openRow();
          return;
        }
        closeRow();
      },
      onPanResponderTerminate: () => {
        closeRow();
      },
    })
  ).current;

  function handleDeletePress() {
    Alert.alert(
      'Delete project?',
      `Are you sure you want to delete "${project.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: closeRow },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(project),
        },
      ]
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.deleteAction, { backgroundColor: theme.delete }]}>
        <Pressable
          style={styles.deleteButton}
          onPress={handleDeletePress}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${project.title}`}
        >
          <Text style={styles.deleteIcon}>✕</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.row, { backgroundColor: theme.background, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <ProjectCard
          project={project}
          onPress={onPress}
          onDelete={handleDeletePress}
          style={styles.card}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  deleteAction: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  deleteButton: {
    width: DELETE_WIDTH,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
  },
  row: {},
  card: {
    marginBottom: 0,
  },
});
