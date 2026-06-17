const { withInfoPlist } = require('@expo/config-plugins');

/** Allow dev HTTP to LAN/hotspot IPs on iOS (App Transport Security). */
function withIosDevHttp(config) {
    return withInfoPlist(config, (config) => {
        const plist = config.modResults;

        plist.NSLocalNetworkUsageDescription =
            plist.NSLocalNetworkUsageDescription ||
            'TuneScribe connects to your development server on the local network.';

        plist.NSBonjourServices = plist.NSBonjourServices || ['_http._tcp', '_https._tcp'];

        const exceptionDomains = {
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
            ...(plist.NSAppTransportSecurity?.NSExceptionDomains || {}),
        };

        plist.NSAppTransportSecurity = {
            ...(plist.NSAppTransportSecurity || {}),
            NSAllowsArbitraryLoads: true,
            NSAllowsLocalNetworking: true,
            NSExceptionDomains: exceptionDomains,
        };

        return config;
    });
}

module.exports = withIosDevHttp;
