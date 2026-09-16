import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { PianoOutputFormat, Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
  onDelete?: () => void;
  style?: StyleProp<ViewStyle>;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString()) {
    return `Today at ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${time}`;
  }
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(seconds?: number): string | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function outputLabel(format?: PianoOutputFormat): string | null {
  if (format === 'sheet_music') return 'Sheet Music';
  if (format === 'chords') return 'Chords';
  if (format === 'both') return 'Both';
  return null;
}

function typeIcon(inputType?: Project['inputType']): string {
  if (inputType === 'vocal') return 'waveform';
  if (inputType === 'sheet') return 'arrow.up.arrow.down';
  return 'music.note';
}

function typeLabel(inputType?: Project['inputType']): string | null {
  if (inputType === 'piano') return 'Piano';
  if (inputType === 'vocal') return 'Vocal';
  if (inputType === 'sheet') return 'Transpose';
  return null;
}

export default function ProjectCard({ project, onPress, onDelete, style }: ProjectCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => ({
    card: { gap: 10 },
    top: {
      flexDirection: 'row' as const,
      alignItems: 'flex-start' as const,
      gap: 12,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: t.banner,
    },
    body: { flex: 1, minWidth: 0, gap: 4 },
    title: { fontSize: 16, fontWeight: '700' as const, color: t.text },
    meta: { fontSize: 13, color: t.textMuted },
    tags: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginTop: 2 },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: t.chipBackground,
    },
    tagText: { fontSize: 11, fontWeight: '600' as const, color: t.chipText },
    footer: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      gap: 8,
    },
    status: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusText: { fontSize: 11, fontWeight: '700' as const, textTransform: 'capitalize' as const },
    menu: {
      width: 32,
      height: 32,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    error: { fontSize: 12, color: t.error },
  }));

  const statusColor = theme.status[project.status as keyof typeof theme.status] ?? theme.textSubtle;
  const tags = [
    typeLabel(project.inputType),
    outputLabel(project.pianoOutputFormat),
    project.detectedKey,
  ].filter((value): value is string => Boolean(value));
  const duration = formatDuration(project.durationSeconds);
  const meta = [formatRelativeTime(project.createdAt), duration].filter(Boolean).join(' • ');

  return (
    <Pressable onPress={onPress}>
      <Card style={[styles.card, style]}>
        <View style={styles.top}>
          <View style={styles.iconWrap}>
            <SymbolView
              name={typeIcon(project.inputType) as 'music.note'}
              tintColor={theme.primary}
              size={20}
            />
          </View>
          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={2}>
              {project.title}
            </Text>
            <Text style={styles.meta}>{meta}</Text>
            {tags.length > 0 ? (
              <View style={styles.tags}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {onDelete ? (
            <Pressable
              style={styles.menu}
              onPress={onDelete}
              hitSlop={8}
              accessibilityLabel={`Delete ${project.title}`}
            >
              <SymbolView name={'ellipsis' as 'ellipsis'} tintColor={theme.textMuted} size={18} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.footer}>
          <View style={[styles.status, { backgroundColor: `${statusColor}22` }]}>
            {project.status === 'complete' ? (
              <SymbolView
                name={'checkmark.circle.fill' as 'checkmark.circle.fill'}
                tintColor={statusColor}
                size={12}
              />
            ) : null}
            <Text style={[styles.statusText, { color: statusColor }]}>{project.status}</Text>
          </View>
        </View>

        {project.errorMessage ? (
          <Text style={styles.error} numberOfLines={2}>
            {project.errorMessage}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
