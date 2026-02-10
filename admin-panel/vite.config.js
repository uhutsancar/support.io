import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 3002,
  },
  build: {
    // Chunk size optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          'ui-vendor': ['lucide-react', '@headlessui/react'],
          // Socket and HTTP
          'network-vendor': ['socket.io-client', 'axios'],
          // SEO
          'seo-vendor': ['react-helmet-async']
        },
        // Chunk dosya isimleri optimize edilmiş
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      }
    },
    // Minification ve compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Console.log'ları kaldır
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'], // Belirli fonksiyonları kaldır
        passes: 2, // İki geçişli optimizasyon
      },
      mangle: {
        safari10: true, // Safari uyumluluğu
      },
      format: {
        comments: false, // Yorumları kaldır
      },
    },
    // Source maps devre dışı (production)
    sourcemap: false,
    // Chunk boyutu
    chunkSizeWarningLimit: 1000,
    // CSS code splitting
    cssCodeSplit: true,
    // Asset inlining threshold (4kb altı inline et)
    assetsInlineLimit: 4096,
    // Bundle analiz için
    reportCompressedSize: false, // Build hızını artırır
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'axios',
      'socket.io-client'
    ],
    exclude: [], // Gereksiz dependency'leri hariç tut
    esbuildOptions: {
      target: 'es2020', // Modern tarayıcılar için
    },
  },
  // Esbuild target
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
    legalComments: 'none', // Legal comment'leri kaldır
  },
})
