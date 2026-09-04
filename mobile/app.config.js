require('dotenv').config();

const appJson = require('./app.json');

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
const isDev = process.env.APP_VARIANT !== 'production';

module.exports = {
    expo: {
        ...base,
        name: isDev ? 'TuneScribe Dev' : base.name,
        scheme: isDev ? 'tunescribe-dev' : base.scheme,
        plugins: [...(base.plugins || []), './plugins/withIosDevHttp'],
        ios: {
            ...base.ios,
            bundleIdentifier: isDev ? 'com.tunescribe.app.dev' : base.ios?.bundleIdentifier,
            infoPlist: {
                ...base.ios?.infoPlist,
                NSLocalNetworkUsageDescription:
                    'TuneScribe connects to your development server on the local network.',
                ITSAppUsesNonExemptEncryption: false,
                NSAppTransportSecurity: {
                    NSAllowsArbitraryLoads: true,
                    NSAllowsLocalNetworking: true,
                    NSExceptionDomains: buildExceptionDomains(),
                },
            },
        },
        android: {
            ...base.android,
            package: isDev ? 'com.tunescribe.app.dev' : base.android?.package,
            usesCleartextTraffic: true,
        },
        owner: 'wizard10fun',
        extra: {
            ...base.extra,
            apiUrl: process.env.EXPO_PUBLIC_API_URL,
            eas: {
                projectId: '65481381-34ca-4b69-85cb-197823bf7b57',
            },
        },
    },
};
