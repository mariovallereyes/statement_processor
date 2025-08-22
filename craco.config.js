const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Add fallbacks for Node.js modules
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "buffer": require.resolve("buffer"),
        "process": require.resolve("process/browser.js"),
        "stream": require.resolve("stream-browserify"),
        "util": require.resolve("util"),
        "crypto": require.resolve("crypto-browserify"),
        "path": require.resolve("path-browserify"),
        "fs": false,
        "os": false,
        "net": false,
        "tls": false,
        "dns": false,
        "child_process": false,
        "readline": false,
        "zlib": false,
        "http": false,
        "https": false,
        "url": false,
        "querystring": false,
        "timers": false,
        "console": false,
        "constants": false,
        "domain": false,
        "events": false,
        "punycode": false,
        "string_decoder": false,
        "sys": false,
        "tty": false,
        "vm": false
      };

      // Add plugins for polyfills
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser.js',
        }),
      ];

      return webpackConfig;
    },
  },
};