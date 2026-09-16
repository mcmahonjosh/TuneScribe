import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-modules-core', () => ({
  requireOptionalNativeModule: vi.fn(),
}));

const unlockAsync = vi.fn(async () => undefined);
const lockAsync = vi.fn(async () => undefined);

vi.mock('expo-screen-orientation', () => ({
  unlockAsync,
  lockAsync,
  OrientationLock: { PORTRAIT_UP: 3 },
}));

import { requireOptionalNativeModule } from 'expo-modules-core';
import {
  lockAppToPortrait,
  restorePortraitAfterTransition,
  unlockSheetOrientation,
} from '@/utils/sheetOrientation';

describe('sheetOrientation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops when ExpoScreenOrientation native module is missing', async () => {
    vi.mocked(requireOptionalNativeModule).mockReturnValue(null);
    await unlockSheetOrientation();
    await lockAppToPortrait();
    expect(unlockAsync).not.toHaveBeenCalled();
    expect(lockAsync).not.toHaveBeenCalled();
  });

  it('unlocks and locks when the native module is present', async () => {
    vi.mocked(requireOptionalNativeModule).mockReturnValue({});
    await unlockSheetOrientation();
    await lockAppToPortrait();
    expect(unlockAsync).toHaveBeenCalledTimes(1);
    expect(lockAsync).toHaveBeenCalledWith(3);
  });

  it('restorePortraitAfterTransition schedules a portrait lock', async () => {
    vi.mocked(requireOptionalNativeModule).mockReturnValue({});
    const cleanup = restorePortraitAfterTransition();
    cleanup();
    await vi.waitFor(() => {
      expect(lockAsync).toHaveBeenCalledWith(3);
    });
  });
});
