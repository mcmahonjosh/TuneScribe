import Constants from 'expo-constants';

/** Where the JS bundle is loading from in dev (Metro host or embedded). */
export function getJsBundleSource(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.length > 0) {
    return hostUri;
  }

  const debuggerHost = (
    Constants as { expoGoConfig?: { debuggerHost?: string } }
  ).expoGoConfig?.debuggerHost;
  if (typeof debuggerHost === 'string' && debuggerHost.length > 0) {
    return debuggerHost;
  }

  return 'embedded';
}
