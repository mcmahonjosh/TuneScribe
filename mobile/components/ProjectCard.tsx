import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Badge, Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { Project } from '@/types/project';

interface ProjectCardProps {
  project: Project;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function ProjectCard({ project, onPress, style }: ProjectCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => ({
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 6,
    },
    title: { fontSize: 17, fontWeight: '600' as const, flex: 1, marginRight: 8, color: t.text },
    meta: { fontSize: 13, color: t.textMuted },
    error: { fontSize: 12, color: t.error, marginTop: 6 },
  }));

  const statusColor = theme.status[project.status as keyof typeof theme.status] ?? theme.textSubtle;

  return (
    <Pressable onPress={onPress}>
      <Card style={style}>
        <View style={styles.header}>
          <Text style={styles.title}>{project.title}</Text>
          <Badge label={project.status} color={statusColor} />
        </View>
        <Text style={styles.meta}>
          {new Date(project.createdAt).toLocaleString()}
          {project.inputType ? ` · ${project.inputType}` : ''}
        </Text>
        {project.errorMessage ? (
          <Text style={styles.error} numberOfLines={2}>
            {project.errorMessage}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
