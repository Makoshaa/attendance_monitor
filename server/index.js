const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const app = require('./app');

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const keyPath = path.resolve(__dirname, '../certs/localhost-key.pem');
const certPath = path.resolve(__dirname, '../certs/localhost-cert.pem');

const shouldUseHttps =
  process.env.USE_HTTPS !== 'false' &&
  fs.existsSync(keyPath) &&
  fs.existsSync(certPath);

const server = shouldUseHttps
  ? https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      },
      app
    )
  : http.createServer(app);

server.listen(PORT, HOST, () => {
  const protocol = shouldUseHttps ? 'https' : 'http';
  console.log(`Server listening on ${protocol}://${HOST}:${PORT}`);

  if (!shouldUseHttps) {
    console.log('TLS certificates not found; started HTTP server instead.');
  }
});
