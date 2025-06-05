import { defineConfig } from 'vite';
import { resolve } from 'path';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig({
  root: 'src/main/resources',
  base: '/static/',

  build: {
    outDir: resolve(__dirname, 'src/main/resources/static/dist'),
    emptyOutDir: true,

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/main/resources/static/scripts/master_page.js'),
        config: resolve(__dirname, 'src/main/resources/static/scripts/config.js'),
        service: resolve(__dirname, 'src/main/resources/static/scripts/service.js'),
      },

      output: {
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',

        // Preserve globals for backward compatibility
        globals: {
          jquery: '$',
          'jquery-ui': 'jQuery.ui',
          bootstrap: 'bootstrap',
          plotly: 'Plotly',
          mathjax: 'MathJax'
        },

        // Manual chunks for better caching
        manualChunks: {
          'vendor-jquery': ['jquery', 'jquery-ui'],
          'vendor-bootstrap': ['bootstrap'],
          'vendor-plotly': ['plotly.js'],
          'vendor-utils': ['async', 'fingerprint2', 'html2canvas', 'jspdf']
        }
      }
    },

    // Keep legacy browser support
    target: 'es2015',

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true
      }
    },

    // Source maps for debugging
    sourcemap: true,

    // Chunk size warnings
    chunkSizeWarningLimit: 1000
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/main/resources/static'),
      '@scripts': resolve(__dirname, 'src/main/resources/static/scripts'),
      '@styles': resolve(__dirname, 'src/main/resources/static/styles'),
      '@external': resolve(__dirname, 'src/main/resources/static/scripts/external')
    }
  },

  plugins: [
    // Support legacy browsers
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],

  server: {
    port: 3000,
    proxy: {
      // Proxy API calls to Flask backend
      '/get_config': 'http://localhost:5001',
      '/upload': 'http://localhost:5001',
      '/get_dataset_header': 'http://localhost:5001',
      '/append_file_to_dataset': 'http://localhost:5001',
      '/apply_filters': 'http://localhost:5001',
      '/get_plot_data': 'http://localhost:5001',
      '/get_lightcurve': 'http://localhost:5001',
      '/get_divided_lightcurves_from_colors': 'http://localhost:5001',
      '/get_joined_lightcurves': 'http://localhost:5001',
      '/get_divided_lightcurve_ds': 'http://localhost:5001',
      '/get_dataset_schema': 'http://localhost:5001'
    }
  },

  define: {
    // Define global constants
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '2.0.0')
  },

  optimizeDeps: {
    include: [
      'jquery',
      'bootstrap',
      'plotly.js/dist/plotly',
      'async',
      'fingerprint2'
    ],
    exclude: [
      'electron'
    ]
  }
});