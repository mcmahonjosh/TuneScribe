import { SymbolView } from 'expo-symbols';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import SwipeableProjectRow from '@/components/SwipeableProjectRow';
import { AppHeader, MutedText, Screen } from '@/components/ui';
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

  const openRecord = useCallback(() => {
    router.push('/(tabs)/record');
  }, [router]);

  return (
    <Screen style={styles.screen}>
      <AppHeader title="TuneScribe" subtitle="On-device piano & vocal transcription" />

      <Pressable
        onPress={openRecord}
        style={({ pressed }) => [
          styles.hero,
          { backgroundColor: theme.primary, opacity: pressed ? 0.88 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="New Recording"
      >
        <View style={[styles.heroIcon, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
          <SymbolView name={'mic.fill' as 'mic.fill'} tintColor={theme.primaryText} size={22} />
        </View>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: theme.primaryText }]}>+ New Recording</Text>
          <Text style={[styles.heroSubtitle, { color: theme.primaryText }]}>
            Piano or vocal transcription
          </Text>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Projects</Text>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        style={styles.listFlex}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <MutedText style={[styles.empty, { color: theme.textMuted }]}>
            Record a piano or vocal clip to turn it into sheet music or chords.
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
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },
  heroTitle: { fontSize: 18, fontWeight: '700' },
  heroSubtitle: { fontSize: 13, opacity: 0.85 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  listFlex: { flex: 1 },
  list: { paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 28, marginBottom: 8, fontSize: 15, lineHeight: 22 },
});
