require('dotenv').config();

const appJson = require('./app.json');

/**
 * Development builds (EAS profile `development` or local Metro) need HTTP to LAN/hotspot.
 * Production / App Store builds must not allow arbitrary cleartext loads.
 */
function isDevBuild() {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (profile === 'production' || profile === 'preview') {
    return false;
  }
  if (profile === 'development') {
    return true;
  }
  // Local `expo start` often evaluates this file with NODE_ENV=production.
  // Using NODE_ENV here made the QR use the App Store scheme (`tunescribe`)
  // instead of TuneScribe Dev (`tunescribe-dev`).
  return true;
}

function getDevHostFromEnv() {
  const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    const value = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function buildExceptionDomains() {
  const domains = {
    localhost: {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    },
    '127.0.0.1': {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    },
    '172.20.10.2': {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    },
    '172.20.10.12': {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    },
  };

  const devHost = getDevHostFromEnv();
  if (devHost && !domains[devHost]) {
    domains[devHost] = {
      NSExceptionAllowsInsecureHTTPLoads: true,
      NSIncludesSubdomains: true,
    };
  }

  return domains;
}

const base = appJson.expo;
const devBuild = isDevBuild();

const plugins = (base.plugins || []).filter((plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  // Production App Store builds should not ship the Expo dev-client plugin.
  if (!devBuild && name === 'expo-dev-client') {
    return false;
  }
  return true;
});

if (devBuild) {
  plugins.push('./plugins/withIosDevHttp');
}

const iosInfoPlist = {
  ...base.ios?.infoPlist,
  ITSAppUsesNonExemptEncryption: false,
};

if (devBuild) {
  iosInfoPlist.NSLocalNetworkUsageDescription =
    'TuneScribe connects to your development server on the local network.';
  iosInfoPlist.NSAppTransportSecurity = {
    NSAllowsArbitraryLoads: true,
    NSAllowsLocalNetworking: true,
    NSExceptionDomains: buildExceptionDomains(),
  };
}

module.exports = {
  expo: {
    ...base,
    name: devBuild ? 'TuneScribe Dev' : base.name,
    scheme: devBuild ? 'tunescribe-dev' : base.scheme,
    plugins,
    ios: {
      ...base.ios,
      bundleIdentifier: devBuild ? 'com.tunescribe.app.dev' : base.ios?.bundleIdentifier,
      infoPlist: iosInfoPlist,
    },
    android: {
      ...base.android,
      package: devBuild ? 'com.tunescribe.app.dev' : base.android?.package,
      ...(devBuild ? { usesCleartextTraffic: true } : { usesCleartextTraffic: false }),
    },
    owner: 'wizard10fun',
    extra: {
      ...base.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      offlineOnly: true,
      eas: {
        projectId: '65481381-34ca-4b69-85cb-197823bf7b57',
      },
    },
  },
};
