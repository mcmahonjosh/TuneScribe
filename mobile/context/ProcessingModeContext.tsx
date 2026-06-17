import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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

const DEFAULT_MODE: ProcessingMode = 'backend';

const ProcessingModeContext = createContext<ProcessingModeContextValue | null>(null);

export function ProcessingModeProvider({ children }: { children: ReactNode }) {
  const [processingMode, setProcessingModeState] = useState<ProcessingMode>(DEFAULT_MODE);

  useEffect(() => {
    void loadProcessingMode().then((stored) => {
      if (stored) {
        setProcessingModeState(stored);
      }
    });
  }, []);

  const setProcessingMode = useCallback((mode: ProcessingMode) => {
    setProcessingModeState(mode);
    void saveProcessingMode(mode);
  }, []);

  const toggleProcessingMode = useCallback(() => {
    setProcessingMode(processingMode === 'backend' ? 'local' : 'backend');
  }, [processingMode, setProcessingMode]);

  const value = useMemo(
    () => ({
      processingMode,
      isLocalMode: processingMode === 'local',
      setProcessingMode,
      toggleProcessingMode,
    }),
    [processingMode, setProcessingMode, toggleProcessingMode]
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
