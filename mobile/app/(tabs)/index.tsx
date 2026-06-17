import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import SwipeableProjectRow from '@/components/SwipeableProjectRow';
import { AppHeader, Button, MutedText, Screen } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { deleteProjectFiles } from '@/services/files';
import { deleteProject, listProjects } from '@/storage/projectRepository';
import { Project } from '@/types/project';

export default function ProjectsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);

  const loadProjects = useCallback(async () => {
    const data = await listProjects();
    setProjects(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  const handleDeleteProject = useCallback(async (project: Project) => {
    await deleteProjectFiles(project.id);
    await deleteProject(project.id);
    setProjects((current) => current.filter((entry) => entry.id !== project.id));
  }, []);

  return (
    <Screen style={styles.screen}>
      <AppHeader title="TuneScribe" subtitle="Your transcription projects" />

      <Button
        label="+ New Recording"
        onPress={() => router.push('/(tabs)/record')}
        style={styles.newButton}
      />

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        style={styles.listFlex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <MutedText style={[styles.empty, { color: theme.textMuted }]}>
            No projects yet. Record a piano or vocal clip to get started.
          </MutedText>
        }
        renderItem={({ item }) => (
          <SwipeableProjectRow
            project={item}
            onPress={() => router.push(`/project/${item.id}`)}
            onDelete={handleDeleteProject}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0, flex: 1 },
  newButton: { marginBottom: 16 },
  listFlex: { flex: 1 },
  list: { paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 15 },
});
