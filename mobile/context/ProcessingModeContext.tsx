import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { OFFLINE_ONLY } from '@/constants/appConfig';
import {
  loadProcessingMode,
  saveProcessingMode,
} from '@/storage/processingModePreferences';
import { type ProcessingMode } from '@/services/processing/types';

interface ProcessingModeContextValue {
  processingMode: ProcessingMode;
  isLocalMode: boolean;
  setProcessingMode: (mode: ProcessingMode) => void;
  toggleProcessingMode: () => void;
}

const DEFAULT_MODE: ProcessingMode = OFFLINE_ONLY ? 'local' : 'backend';

const ProcessingModeContext = createContext<ProcessingModeContextValue | null>(null);

export function ProcessingModeProvider({ children }: { children: ReactNode }) {
  const [processingMode, setProcessingModeState] = useState<ProcessingMode>(DEFAULT_MODE);

  useEffect(() => {
    if (OFFLINE_ONLY) {
      return;
    }
    void loadProcessingMode().then((stored) => {
      if (stored) {
        setProcessingModeState(stored);
      }
    });
  }, []);

  const setProcessingMode = useCallback((mode: ProcessingMode) => {
    if (OFFLINE_ONLY) {
      return;
    }
    setProcessingModeState(mode);
    void saveProcessingMode(mode);
  }, []);

  const toggleProcessingMode = useCallback(() => {
    if (OFFLINE_ONLY) {
      return;
    }
    setProcessingMode(processingMode === 'backend' ? 'local' : 'backend');
  }, [processingMode, setProcessingMode]);

  const effectiveMode: ProcessingMode = OFFLINE_ONLY ? 'local' : processingMode;

  const value = useMemo(
    () => ({
      processingMode: effectiveMode,
      isLocalMode: effectiveMode === 'local',
      setProcessingMode,
      toggleProcessingMode,
    }),
    [effectiveMode, setProcessingMode, toggleProcessingMode]
  );

  return (
    <ProcessingModeContext.Provider value={value}>{children}</ProcessingModeContext.Provider>
  );
}

export function useProcessingMode(): ProcessingModeContextValue {
  const context = useContext(ProcessingModeContext);
  if (!context) {
    throw new Error('useProcessingMode must be used within ProcessingModeProvider');
  }
  return context;
}
