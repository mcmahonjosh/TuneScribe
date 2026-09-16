import { vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  writeAsStringAsync: vi.fn(async () => undefined),
  readAsStringAsync: vi.fn(async () => ''),
}));

vi.mock('react-native', () => ({
  InteractionManager: {
    runAfterInteractions: (cb: () => void) => {
      cb();
      return { cancel: vi.fn() };
    },
  },
  Platform: { OS: 'ios', select: (obj: Record<string, unknown>) => obj.ios },
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'View',
  Text: 'Text',
}));
