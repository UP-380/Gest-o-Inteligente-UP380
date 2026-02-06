import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path, // Não reescrever o path, manter /api
        cookieDomainRewrite: '',
        cookiePathRewrite: '/',
        configure: (proxy, _options) => {
          // Garantir que cookies sejam enviados e repassados
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            // Garantir que cookies sejam repassados
            if (proxyRes.headers['set-cookie']) {
              proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                return cookie.replace(/Domain=[^;]+;?/gi, '')
                             .replace(/Path=[^;]+;?/gi, 'Path=/;')
                             .replace(/Secure;?/gi, '')
                             .replace(/SameSite=None;?/gi, 'SameSite=Lax;');
              });
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Desabilitar sourcemaps em produção para segurança
    minify: 'esbuild', // Usar esbuild (padrão do Vite, já vem instalado)
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

