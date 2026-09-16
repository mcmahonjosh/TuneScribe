import { requireOptionalNativeModule } from 'expo-modules-core';
import { InteractionManager } from 'react-native';

function hasScreenOrientationNativeModule() {
  return requireOptionalNativeModule('ExpoScreenOrientation') != null;
}

async function withScreenOrientation<T>(
  run: (mod: typeof import('expo-screen-orientation')) => Promise<T>
): Promise<T | null> {
  if (!hasScreenOrientationNativeModule()) {
    return null;
  }
  try {
    const ScreenOrientation = await import('expo-screen-orientation');
    return await run(ScreenOrientation);
  } catch {
    return null;
  }
}

/** Allow portrait and landscape while reading full-screen sheet music. */
export async function unlockSheetOrientation() {
  await withScreenOrientation((ScreenOrientation) => ScreenOrientation.unlockAsync());
}

/** Keep the rest of the app in portrait after leaving the sheet screen. */
export async function lockAppToPortrait() {
  await withScreenOrientation((ScreenOrientation) =>
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP)
  );
}

export function restorePortraitAfterTransition() {
  return () => {
    InteractionManager.runAfterInteractions(() => {
      void lockAppToPortrait();
    });
  };
}
