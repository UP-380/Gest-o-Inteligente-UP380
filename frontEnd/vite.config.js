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
          proxy.on('error', (err, _req, _res) => {
            console.error('❌ Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Garantir que cookies sejam enviados
            if (req.headers.cookie) {
              proxyReq.setHeader('Cookie', req.headers.cookie);
            }
            console.log('📤 Vite Proxying Request:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('📥 Vite Proxying Response:', req.method, req.url, 'Status:', proxyRes.statusCode);
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

