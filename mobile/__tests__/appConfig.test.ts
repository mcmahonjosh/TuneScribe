import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const mobileRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadAppConfig(env: Record<string, string>) {
  const script = `
    const cfg = require(${JSON.stringify(path.join(mobileRoot, 'app.config.js'))});
    process.stdout.write(JSON.stringify(cfg.expo || cfg.default?.expo || cfg));
  `;
  const stdout = execFileSync(process.execPath, ['-e', script], {
    cwd: mobileRoot,
    env: { ...process.env, ...env, DOTENV_CONFIG_QUIET: 'true' },
    encoding: 'utf8',
  });
  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) {
    throw new Error(`app.config produced no JSON:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(jsonStart)) as Record<string, unknown>;
}

describe('app.config production gates', () => {
  it('strips expo-dev-client and cleartext for production profile', () => {
    const expo = loadAppConfig({
      EAS_BUILD_PROFILE: 'production',
      NODE_ENV: 'production',
    });

    const pluginNames = ((expo.plugins as unknown[]) || []).map((plugin) =>
      Array.isArray(plugin) ? plugin[0] : plugin
    );
    expect(pluginNames).not.toContain('expo-dev-client');
    expect(pluginNames).not.toContain('./plugins/withIosDevHttp');

    const ios = expo.ios as {
      infoPlist?: { NSAppTransportSecurity?: unknown };
      bundleIdentifier?: string;
    };
    expect(ios.infoPlist?.NSAppTransportSecurity).toBeUndefined();
    expect(ios.bundleIdentifier).toBe('com.tunescribe.app');

    const android = expo.android as { usesCleartextTraffic?: boolean; package?: string };
    expect(android.usesCleartextTraffic).toBe(false);
    expect(android.package).toBe('com.tunescribe.app');
    expect(expo.name).toBe('TuneScribe');
    expect(expo.scheme).toBe('tunescribe');
  });

  it('keeps TuneScribe Dev identity for development profile', () => {
    const expo = loadAppConfig({
      EAS_BUILD_PROFILE: 'development',
      NODE_ENV: 'development',
    });

    expect(expo.name).toBe('TuneScribe Dev');
    expect(expo.scheme).toBe('tunescribe-dev');
    const ios = expo.ios as {
      bundleIdentifier?: string;
      infoPlist?: { NSAppTransportSecurity?: unknown };
    };
    expect(ios.bundleIdentifier).toBe('com.tunescribe.app.dev');
    expect(ios.infoPlist?.NSAppTransportSecurity).toBeTruthy();
  });
});
