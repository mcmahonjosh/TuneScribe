export type ThemeId = 'violet' | 'amber';

export interface StatusColors {
  complete: string;
  failed: string;
  processing: string;
  uploading: string;
  recording: string;
  idle: string;
}

export interface AppTheme {
  id: ThemeId;
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryMuted: string;
  primaryText: string;
  border: string;
  borderSubtle: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;
  accentSecondary: string;
  chipBackground: string;
  chipBackgroundActive: string;
  chipText: string;
  chipTextActive: string;
  tabBar: string;
  tabBarBorder: string;
  tabIconDefault: string;
  tabIconSelected: string;
  overlay: string;
  banner: string;
  bannerText: string;
  delete: string;
  status: StatusColors;
  sheetBackground: string;
  sheetHighlight: string;
}

const statusViolet: StatusColors = {
  complete: '#4ade80',
  failed: '#f87171',
  processing: '#fbbf24',
  uploading: '#7c8cff',
  recording: '#a78bfa',
  idle: '#6b7280',
};

const statusAmber: StatusColors = {
  complete: '#86efac',
  failed: '#fca5a5',
  processing: '#fcd34d',
  uploading: '#e8a84a',
  recording: '#d4a054',
  idle: '#78716c',
};

export const themes: Record<ThemeId, AppTheme> = {
  violet: {
    id: 'violet',
    background: '#0c0e14',
    surface: '#161a22',
    surfaceElevated: '#1e2430',
    text: '#f4f6fb',
    textMuted: '#9aa3b5',
    textSubtle: '#6b7280',
    primary: '#7c8cff',
    primaryMuted: '#5a6abf',
    primaryText: '#ffffff',
    border: '#2a3140',
    borderSubtle: '#1e2430',
    success: '#4ade80',
    successMuted: '#166534',
    warning: '#fbbf24',
    warningMuted: '#78350f',
    error: '#f87171',
    errorMuted: '#7f1d1d',
    accentSecondary: '#a78bfa',
    chipBackground: '#1e2430',
    chipBackgroundActive: '#7c8cff',
    chipText: '#c5cad6',
    chipTextActive: '#ffffff',
    tabBar: '#12151c',
    tabBarBorder: '#2a3140',
    tabIconDefault: '#6b7280',
    tabIconSelected: '#7c8cff',
    overlay: 'rgba(0,0,0,0.55)',
    banner: '#1a2040',
    bannerText: '#c5d0ff',
    delete: '#dc2626',
    status: statusViolet,
    sheetBackground: '#12151c',
    sheetHighlight: 'rgba(124, 140, 255, 0.35)',
  },
  amber: {
    id: 'amber',
    background: '#12100c',
    surface: '#1c1812',
    surfaceElevated: '#252018',
    text: '#faf6ef',
    textMuted: '#b8a894',
    textSubtle: '#8a7a68',
    primary: '#e8a84a',
    primaryMuted: '#b8862e',
    primaryText: '#1a1208',
    border: '#3d3428',
    borderSubtle: '#2a241c',
    success: '#86efac',
    successMuted: '#14532d',
    warning: '#fcd34d',
    warningMuted: '#713f12',
    error: '#fca5a5',
    errorMuted: '#7f1d1d',
    accentSecondary: '#d4a054',
    chipBackground: '#252018',
    chipBackgroundActive: '#e8a84a',
    chipText: '#c9b89a',
    chipTextActive: '#1a1208',
    tabBar: '#181410',
    tabBarBorder: '#3d3428',
    tabIconDefault: '#8a7a68',
    tabIconSelected: '#e8a84a',
    overlay: 'rgba(0,0,0,0.55)',
    banner: '#2a2218',
    bannerText: '#f0d9b0',
    delete: '#b91c1c',
    status: statusAmber,
    sheetBackground: '#181410',
    sheetHighlight: 'rgba(232, 168, 74, 0.35)',
  },
};

export const DEFAULT_THEME_ID: ThemeId = 'violet';
