import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig(async () => {
  const { default: react } = await import('@vitejs/plugin-react');

  // Проверяем, существуют ли SSL сертификаты
  const keyPath = path.resolve(__dirname, 'certs/localhost-key.pem');
  const certPath = path.resolve(__dirname, 'certs/localhost-cert.pem');
  const hasCertificates = fs.existsSync(keyPath) && fs.existsSync(certPath);

  const config = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: 'https://localhost:5000',
          changeOrigin: true,
          secure: false
        },
        '/models': {
          target: 'https://localhost:5000',
          changeOrigin: true,
          secure: false
        }
      }
    }
  };

  // Добавляем HTTPS только если сертификаты существуют
  if (hasCertificates) {
    config.server.https = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  }

  return config;
});
