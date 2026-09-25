import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
export default defineConfig({
  plugins: [
    react(),
  ],
  // postcss.config.js used to hold this; inlining it means the project carries
  // no JavaScript config file of its own.
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 3002,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/, priority: 20 },
            { name: 'ui-vendor', test: /node_modules[\\/](@headlessui|lucide-react)[\\/]/, priority: 15 },
            { name: 'network-vendor', test: /node_modules[\\/](socket\.io-client|axios)[\\/]/, priority: 15 },
            { name: 'seo-vendor', test: /node_modules[\\/]react-helmet-async[\\/]/, priority: 15 }
          ]
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
        passes: 2,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'axios',
      'socket.io-client',
      // Pazarlama sayfalarinin kutuphaneleri; ilk ziyarette kesfedilince Vite
      // sayfayi bir kez daha yukluyordu.
      'motion/react',
      'embla-carousel-react',
      'embla-carousel-autoplay',
      '@radix-ui/react-accordion',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-tabs'
    ],
    exclude: []
  },
})
