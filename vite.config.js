import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

export default defineConfig(async () => {
  const { default: react } = await import('@vitejs/plugin-react');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: {
        key: fs.readFileSync(path.resolve(__dirname, 'certs/localhost-key.pem')),
        cert: fs.readFileSync(path.resolve(__dirname, 'certs/localhost-cert.pem'))
      },
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
});
