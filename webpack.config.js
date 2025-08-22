const path = require('path');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    // Optimization for production builds
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          // Separate vendor libraries
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
          // Separate AI/ML libraries (large dependencies)
          aiLibs: {
            test: /[\\/]node_modules[\\/](@tensorflow|tesseract\.js|natural|pdfjs-dist)[\\/]/,
            name: 'ai-libs',
            chunks: 'all',
            priority: 20,
          },
          // Common utilities
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
      // Enable tree shaking
      usedExports: true,
      sideEffects: false,
    },

    // Performance budgets
    performance: {
      maxAssetSize: 2000000, // 2MB
      maxEntrypointSize: 2000000, // 2MB
      hints: isProduction ? 'error' : 'warning',
    },

    // Resolve configuration for better tree shaking
    resolve: {
      alias: {
        // Use ES modules versions when available
        'lodash': 'lodash-es',
      },
    },

    // Plugins for production optimization
    plugins: [
      // Define environment variables
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
        'process.env.REACT_APP_VERSION': JSON.stringify(process.env.npm_package_version || '1.0.0'),
      }),

      // Analyze bundle size in production
      ...(isProduction && process.env.ANALYZE ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html',
        })
      ] : []),

      // Provide polyfills for Node.js modules used by some libraries
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
        process: 'process/browser',
      }),
    ],

    // Module rules for optimization
    module: {
      rules: [
        // Optimize images
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb
            },
          },
          generator: {
            filename: 'static/media/[name].[hash:8][ext]',
          },
        },
        // Optimize fonts
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'static/fonts/[name].[hash:8][ext]',
          },
        },
      ],
    },

    // Fallbacks for Node.js modules
    resolve: {
      fallback: {
        "buffer": require.resolve("buffer"),
        "process": require.resolve("process/browser"),
        "stream": require.resolve("stream-browserify"),
        "util": require.resolve("util"),
        "crypto": require.resolve("crypto-browserify"),
        "fs": false,
        "path": require.resolve("path-browserify"),
      },
    },
  };
};